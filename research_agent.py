"""
Improved AI-Powered Research Agent with Reliable News Sources
Author: Investment Assistant System
Phase: 1 - Enhanced Research Agent with Better News APIs
"""

import requests
import yfinance as yf
import pandas as pd
import json
import time
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import openai
from bs4 import BeautifulSoup
import feedparser
import logging
from dataclasses import dataclass
import urllib.parse

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class ResearchResult:
    """Structure for research findings"""
    ticker: str
    title: str
    summary: str
    source: str
    timestamp: datetime
    relevance_score: float
    key_metrics: Dict
    trading_insights: List[str]

class ImprovedResearchAgent:
    """
    Enhanced Financial Research Agent with Better News Sources
    """
    
    def __init__(self, openai_api_key: str, alpha_vantage_key: Optional[str] = None, 
                 newsapi_key: Optional[str] = None, polygon_key: Optional[str] = None):
        """
        Initialize the Enhanced Research Agent
        
        Args:
            openai_api_key: Your OpenAI API key
            alpha_vantage_key: Alpha Vantage API key (recommended)
            newsapi_key: NewsAPI.org key (free tier: 100 requests/day)
            polygon_key: Polygon.io key (optional, for premium news)
        """
        self.openai_client = openai.OpenAI(api_key=openai_api_key)
        self.alpha_vantage_key = alpha_vantage_key
        self.newsapi_key = newsapi_key
        self.polygon_key = polygon_key
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        
    def get_newsapi_articles(self, ticker: str, company_name: str, days_back: int = 7) -> List[Dict]:
        """
        Get news from NewsAPI.org (much more reliable than Yahoo Finance)
        Free tier: 100 requests/day, 500 per month
        """
        if not self.newsapi_key:
            logger.debug(f"No NewsAPI key provided, skipping NewsAPI for {ticker}")
            return []
            
        try:
            # Calculate date range
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days_back)
            
            # Search for company name and ticker
            query = f'"{company_name}" OR "{ticker}" AND (stock OR shares OR earnings OR financial)'
            logger.debug(f"NewsAPI query for {ticker}: {query}")
            
            url = "https://newsapi.org/v2/everything"
            params = {
                'q': query,
                'language': 'en',
                'sortBy': 'relevancy',
                'from': start_date.strftime('%Y-%m-%d'),
                'to': end_date.strftime('%Y-%m-%d'),
                'pageSize': 20,
                'apiKey': self.newsapi_key
            }
            
            response = self.session.get(url, params=params)
            data = response.json()
            logger.debug(f"NewsAPI response status for {ticker}: {response.status_code}")
            
            news_data = []
            if 'articles' in data:
                logger.debug(f"NewsAPI returned {len(data['articles'])} total articles for {ticker}")
                for i, article in enumerate(data['articles']):
                    try:
                        # Filter out generic news
                        title = article.get('title', '').lower()
                        description = article.get('description', '').lower()
                        
                        # Check relevance to our ticker/company
                        if (ticker.lower() in title or company_name.lower() in title or
                            ticker.lower() in description or company_name.lower() in description):
                            
                            # Fix timezone handling
                            published_at = article.get('publishedAt', '')
                            if published_at:
                                # Convert to timezone-naive datetime
                                if published_at.endswith('Z'):
                                    timestamp = datetime.fromisoformat(published_at.replace('Z', '+00:00')).replace(tzinfo=None)
                                else:
                                    timestamp = datetime.fromisoformat(published_at).replace(tzinfo=None)
                            else:
                                timestamp = datetime.now()
                            
                            news_data.append({
                                'title': article.get('title', ''),
                                'summary': article.get('description', ''),
                                'url': article.get('url', ''),
                                'publisher': article.get('source', {}).get('name', 'NewsAPI'),
                                'timestamp': timestamp,
                                'source': 'newsapi'
                            })
                            logger.debug(f"Added relevant NewsAPI article {i+1} for {ticker}: {article.get('title', '')[:50]}...")
                            
                    except Exception as e:
                        logger.warning(f"Error processing NewsAPI article {i+1} for {ticker}: {e}")
                        continue
            else:
                logger.warning(f"NewsAPI response missing 'articles' key for {ticker}: {data}")
            
            logger.info(f"Collected {len(news_data)} relevant articles from NewsAPI for {ticker}")
            return news_data
            
        except Exception as e:
            logger.error(f"Error fetching NewsAPI news for {ticker}: {e}")
            return []
    
    def get_alpha_vantage_news(self, ticker: str) -> List[Dict]:
        """
        Enhanced Alpha Vantage news with better error handling and debugging
        """
        if not self.alpha_vantage_key:
            logger.debug(f"No Alpha Vantage key provided, skipping for {ticker}")
            return []
            
        try:
            url = f"https://www.alphavantage.co/query"
            params = {
                'function': 'NEWS_SENTIMENT',
                'tickers': ticker,
                'apikey': self.alpha_vantage_key,
                'limit': 50,  # Get more articles
                'sort': 'LATEST'
            }
            
            logger.debug(f"Alpha Vantage request for {ticker}: {params}")
            response = self.session.get(url, params=params)
            data = response.json()
            logger.debug(f"Alpha Vantage response status for {ticker}: {response.status_code}")
            
            news_data = []
            if 'feed' in data:
                logger.debug(f"Alpha Vantage returned {len(data['feed'])} articles for {ticker}")
                for i, article in enumerate(data['feed']):
                    try:
                        title = article.get('title', '').strip()
                        summary = article.get('summary', '').strip()
                        
                        # Skip if both are empty
                        if not title and not summary:
                            logger.debug(f"Skipping empty Alpha Vantage article {i+1} for {ticker}")
                            continue
                        
                        # Check if article is actually about our ticker
                        ticker_sentiment = None
                        if 'ticker_sentiment' in article:
                            for sentiment in article['ticker_sentiment']:
                                if sentiment.get('ticker') == ticker:
                                    ticker_sentiment = sentiment
                                    break
                        
                        # Only include if relevance score > 0.3 or if ticker is mentioned
                        if ticker_sentiment and float(ticker_sentiment.get('relevance_score', 0)) > 0.3:
                            # Fix timezone handling for Alpha Vantage
                            time_published = article.get('time_published', '20250617T120000')
                            try:
                                timestamp = datetime.strptime(time_published, '%Y%m%dT%H%M%S')
                            except ValueError:
                                logger.warning(f"Invalid timestamp from Alpha Vantage: {time_published}")
                                timestamp = datetime.now()
                            
                            news_data.append({
                                'title': title or f"{ticker} Alpha Vantage News",
                                'summary': summary,
                                'url': article.get('url', ''),
                                'publisher': article.get('source', 'Alpha Vantage'),
                                'timestamp': timestamp,
                                'source': 'alpha_vantage',
                                'sentiment_score': ticker_sentiment.get('ticker_sentiment_score', 0),
                                'relevance_score': ticker_sentiment.get('relevance_score', 0)
                            })
                            logger.debug(f"Added relevant Alpha Vantage article {i+1} for {ticker}: {title[:50]}...")
                        else:
                            logger.debug(f"Skipping low-relevance Alpha Vantage article {i+1} for {ticker}")
                            
                    except Exception as e:
                        logger.warning(f"Error processing Alpha Vantage article {i+1} for {ticker}: {e}")
                        continue
            else:
                logger.warning(f"Alpha Vantage response missing 'feed' key for {ticker}: {list(data.keys())}")
            
            logger.info(f"Collected {len(news_data)} relevant articles from Alpha Vantage for {ticker}")
            return news_data
            
        except Exception as e:
            logger.error(f"Error fetching Alpha Vantage news for {ticker}: {e}")
            return []
    
    def get_finviz_news(self, ticker: str) -> List[Dict]:
        """
        Scrape news from Finviz (free, reliable, stock-specific)
        """
        try:
            url = f"https://finviz.com/quote.ashx?t={ticker}"
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            
            response = requests.get(url, headers=headers)
            soup = BeautifulSoup(response.content, 'html.parser')
            
            news_data = []
            news_table = soup.find('table', {'class': 'fullview-news-outer'})
            
            if news_table:
                for row in news_table.find_all('tr'):
                    cells = row.find_all('td')
                    if len(cells) >= 2:
                        # Extract time and title
                        time_cell = cells[0].get_text().strip()
                        title_cell = cells[1]
                        
                        link = title_cell.find('a')
                        if link:
                            title = link.get_text().strip()
                            url = link.get('href', '')
                            
                            # Parse timestamp
                            try:
                                if 'AM' in time_cell or 'PM' in time_cell:
                                    # Today's news
                                    news_time = datetime.strptime(time_cell, '%I:%M%p').time()
                                    news_date = datetime.now().date()
                                    timestamp = datetime.combine(news_date, news_time)
                                else:
                                    # Date format like "Dec-15-24"
                                    timestamp = datetime.strptime(time_cell, '%b-%d-%y')
                            except:
                                timestamp = datetime.now()
                            
                            news_data.append({
                                'title': title,
                                'summary': title,  # Finviz doesn't provide summaries
                                'url': url,
                                'publisher': 'Finviz',
                                'timestamp': timestamp,
                                'source': 'finviz'
                            })
            
            logger.info(f"Collected {len(news_data)} articles from Finviz for {ticker}")
            return news_data[:10]  # Limit to 10 most recent
            
        except Exception as e:
            logger.error(f"Error fetching Finviz news for {ticker}: {e}")
            return []
    
    def get_marketwatch_rss(self, ticker: str) -> List[Dict]:
        """
        Get news from MarketWatch RSS feed (reliable, free)
        """
        try:
            # MarketWatch has ticker-specific RSS feeds
            rss_url = f"https://feeds.marketwatch.com/marketwatch/StockPulse/{ticker}/"
            feed = feedparser.parse(rss_url)
            
            news_data = []
            for entry in feed.entries[:10]:
                title = entry.get('title', '').strip()
                summary = entry.get('summary', '').strip()
                
                if title:
                    news_data.append({
                        'title': title,
                        'summary': summary,
                        'url': entry.get('link', ''),
                        'publisher': 'MarketWatch',
                        'timestamp': datetime(*entry.published_parsed[:6]) if hasattr(entry, 'published_parsed') else datetime.now(),
                        'source': 'marketwatch'
                    })
            
            logger.info(f"Collected {len(news_data)} articles from MarketWatch for {ticker}")
            return news_data
            
        except Exception as e:
            logger.error(f"Error fetching MarketWatch news for {ticker}: {e}")
            return []
    
    def get_company_news(self, ticker: str, days_back: int = 7) -> List[Dict]:
        """
        Enhanced news collection from multiple reliable sources
        """
        all_news = []
        company_name = self.get_company_name(ticker)
        
        # 1. NewsAPI - Most reliable, but limited free requests
        newsapi_articles = self.get_newsapi_articles(ticker, company_name, days_back)
        all_news.extend(newsapi_articles)
        
        # 2. Alpha Vantage - Good quality with sentiment scores
        av_articles = self.get_alpha_vantage_news(ticker)
        all_news.extend(av_articles)
        
        # 3. Finviz - Free, stock-specific news
        finviz_articles = self.get_finviz_news(ticker)
        all_news.extend(finviz_articles)
        
        # 4. MarketWatch RSS - Reliable backup
        mw_articles = self.get_marketwatch_rss(ticker)
        all_news.extend(mw_articles)
        
        # 5. Fallback to Google News if we have very few articles
        if len(all_news) < 5:
            google_articles = self.get_google_news_fallback(ticker, company_name)
            all_news.extend(google_articles)
        
        # Remove duplicates based on title similarity
        unique_news = self.deduplicate_news(all_news)
        
        # Sort by timestamp (newest first)
        unique_news.sort(key=lambda x: x['timestamp'], reverse=True)
        
        logger.info(f"Total unique articles collected for {ticker}: {len(unique_news)}")
        return unique_news[:20]  # Return top 20 most recent
    
    def deduplicate_news(self, news_list: List[Dict]) -> List[Dict]:
        """Remove duplicate news articles based on title similarity"""
        unique_news = []
        seen_titles = set()
        
        for article in news_list:
            title = article.get('title', '').lower().strip()
            
            # Create a normalized title for comparison
            normalized_title = ''.join(c for c in title if c.isalnum() or c.isspace())
            normalized_title = ' '.join(normalized_title.split())
            
            # Check if we've seen a similar title
            is_duplicate = False
            for seen_title in seen_titles:
                # Simple similarity check - if 80% of words overlap
                title_words = set(normalized_title.split())
                seen_words = set(seen_title.split())
                
                if len(title_words) > 0 and len(seen_words) > 0:
                    overlap = len(title_words.intersection(seen_words))
                    similarity = overlap / max(len(title_words), len(seen_words))
                    
                    if similarity > 0.8:
                        is_duplicate = True
                        break
            
            if not is_duplicate and normalized_title:
                seen_titles.add(normalized_title)
                unique_news.append(article)
        
        return unique_news
    
    def get_google_news_fallback(self, ticker: str, company_name: str) -> List[Dict]:
        """Fallback Google News with better URL encoding"""
        try:
            encoded_name = urllib.parse.quote(f"{company_name} {ticker} stock")
            rss_url = f"https://news.google.com/rss/search?q={encoded_name}&hl=en-US&gl=US&ceid=US:en"
            feed = feedparser.parse(rss_url)
            
            news_data = []
            for entry in feed.entries[:5]:
                title = entry.get('title', '').strip()
                summary = entry.get('summary', '').strip()
                
                if title:
                    news_data.append({
                        'title': title,
                        'summary': summary,
                        'url': entry.get('link', ''),
                        'publisher': 'Google News',
                        'timestamp': datetime(*entry.published_parsed[:6]) if hasattr(entry, 'published_parsed') else datetime.now(),
                        'source': 'google_news'
                    })
            
            logger.info(f"Collected {len(news_data)} articles from Google News fallback for {ticker}")
            return news_data
            
        except Exception as e:
            logger.error(f"Error fetching Google News fallback for {ticker}: {e}")
            return []
    
    def get_company_name(self, ticker: str) -> str:
        """Get company name from ticker (enhanced)"""
        try:
            stock = yf.Ticker(ticker)
            info = stock.info
            return info.get('longName', info.get('shortName', ticker))
        except:
            return ticker
    
    def get_earnings_data(self, ticker: str) -> Dict:
        """Get earnings data (same as before, but with better error handling)"""
        try:
            stock = yf.Ticker(ticker)
            
            earnings_data = {
                'ticker': ticker,
                'next_earnings_date': None,
                'last_earnings_date': None,
                'eps_estimate': None,
                'revenue_estimate': None,
                'key_metrics': {}
            }
            
            # Get basic info
            try:
                info = stock.info
                earnings_data['key_metrics'] = {
                    'pe_ratio': info.get('trailingPE'),
                    'forward_pe': info.get('forwardPE'),
                    'peg_ratio': info.get('pegRatio'),
                    'price_to_sales': info.get('priceToSalesTrailing12Months'),
                    'debt_to_equity': info.get('debtToEquity'),
                    'roe': info.get('returnOnEquity'),
                    'market_cap': info.get('marketCap'),
                    'revenue_growth': info.get('revenueGrowth')
                }
            except Exception as e:
                logger.warning(f"Could not fetch company info for {ticker}: {e}")
            
            # Get earnings calendar
            try:
                earnings_dates = stock.calendar
                if earnings_dates is not None and hasattr(earnings_dates, 'empty') and not earnings_dates.empty:
                    earnings_data['next_earnings_date'] = earnings_dates.index[0].strftime('%Y-%m-%d')
                    earnings_data['eps_estimate'] = earnings_dates.iloc[0].get('EPS Estimate')
                    earnings_data['revenue_estimate'] = earnings_dates.iloc[0].get('Revenue Estimate')
            except Exception as e:
                logger.warning(f"Could not fetch earnings calendar for {ticker}: {e}")
            
            return earnings_data
            
        except Exception as e:
            logger.error(f"Error fetching earnings data for {ticker}: {e}")
            return {'ticker': ticker, 'error': str(e)}
    
    def analyze_with_ai(self, ticker: str, news_data: List[Dict], earnings_data: Dict) -> ResearchResult:
        """Enhanced AI analysis with better prompt engineering"""
        try:
            # Prepare news context with source diversity
            news_context = ""
            source_count = {}
            
            for i, article in enumerate(news_data[:8]):  # Limit to avoid token limits
                source = article.get('source', 'unknown')
                source_count[source] = source_count.get(source, 0) + 1
                
                title = article.get('title', 'No title')
                summary = article.get('summary', '')[:150]  # Limit summary length
                timestamp = article.get('timestamp', datetime.now()).strftime('%Y-%m-%d')
                
                news_context += f"[{source.upper()}] {timestamp}: {title}\nSummary: {summary}\n\n"
            
            # Prepare earnings context
            metrics = earnings_data.get('key_metrics', {})
            earnings_context = f"""
            Financial Metrics for {ticker}:
            - Next Earnings: {earnings_data.get('next_earnings_date', 'Unknown')}
            - P/E Ratio: {metrics.get('pe_ratio', 'N/A')}
            - Forward P/E: {metrics.get('forward_pe', 'N/A')}
            - PEG Ratio: {metrics.get('peg_ratio', 'N/A')}
            - Market Cap: {metrics.get('market_cap', 'N/A')}
            - Revenue Growth: {metrics.get('revenue_growth', 'N/A')}
            
            News Sources Used: {', '.join(f"{k}({v})" for k, v in source_count.items())}
            """
            
            prompt = f"""
            Analyze the financial data for {ticker} and provide actionable trading insights.
            
            Recent News ({len(news_data)} articles from {len(source_count)} sources):
            {news_context}
            
            {earnings_context}
            
            Respond with ONLY valid JSON in this exact format:
            {{
                "summary": "Concise summary of key developments (max 200 chars)",
                "trading_insights": ["specific actionable insight 1", "specific actionable insight 2", "specific actionable insight 3"],
                "relevance_score": 0.75,
                "risks": ["specific risk 1", "specific risk 2"],
                "opportunities": ["specific opportunity 1", "specific opportunity 2"],
                "sentiment": "bullish/bearish/neutral",
                "confidence": 0.8
            }}
            
            Focus on:
            - Specific price catalysts or events
            - Earnings expectations vs reality
            - Market sentiment shifts
            - Risk factors that could impact stock price
            
            Do not include any text before or after the JSON.
            """
            
            response = self.openai_client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are a financial analyst. You MUST respond with valid JSON only. No additional text."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=600,
                temperature=0.2
            )
            
            response_content = response.choices[0].message.content.strip()
            logger.debug(f"OpenAI response for {ticker}: {response_content[:100]}...")
            
            try:
                ai_analysis = json.loads(response_content)
            except json.JSONDecodeError:
                logger.warning(f"Invalid JSON from OpenAI for {ticker}, creating fallback analysis")
                ai_analysis = {
                    "summary": f"Analysis of {ticker} based on {len(news_data)} news articles",
                    "trading_insights": [f"Monitor {ticker} for developments", "Review upcoming earnings", "Watch market sentiment"],
                    "relevance_score": 0.6,
                    "risks": ["Market volatility", "Sector headwinds"],
                    "opportunities": ["Earnings potential", "Market recovery"],
                    "sentiment": "neutral",
                    "confidence": 0.5
                }
            
            # Create structured result
            result = ResearchResult(
                ticker=ticker,
                title=f"Enhanced Research Analysis: {ticker}",
                summary=ai_analysis.get('summary', ''),
                source=f'ai_analysis_{len(source_count)}_sources',
                timestamp=datetime.now(),
                relevance_score=float(ai_analysis.get('relevance_score', 0.5)),
                key_metrics=earnings_data.get('key_metrics', {}),
                trading_insights=ai_analysis.get('trading_insights', [])
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Error in AI analysis for {ticker}: {e}")
            # Return basic result if AI fails
            return ResearchResult(
                ticker=ticker,
                title=f"Basic Research: {ticker}",
                summary=f"Collected {len(news_data)} news articles from multiple sources",
                source='basic_collection',
                timestamp=datetime.now(),
                relevance_score=0.5,
                key_metrics=earnings_data.get('key_metrics', {}),
                trading_insights=["Manual review recommended", "Multiple news sources available"]
            )
    
    def research_tickers(self, tickers: List[str]) -> List[ResearchResult]:
        """Main research method with enhanced news sources and debugging"""
        results = []
        
        for i, ticker in enumerate(tickers, 1):
            logger.info(f"Researching {ticker} with enhanced news sources... ({i}/{len(tickers)})")
            
            try:
                # Collect enhanced news data
                logger.debug(f"Starting news collection for {ticker}")
                news_data = self.get_company_news(ticker)
                logger.debug(f"Collected {len(news_data)} total news articles for {ticker}")
                
                # Debug: Show sample news data
                if news_data:
                    sample_article = news_data[0]
                    logger.debug(f"Sample article for {ticker}: {sample_article.get('title', 'No title')[:50]}... from {sample_article.get('source')}")
                    logger.debug(f"Sample timestamp type: {type(sample_article.get('timestamp'))}")
                    logger.debug(f"Sample timestamp value: {sample_article.get('timestamp')}")
                
                logger.debug(f"Starting earnings data collection for {ticker}")
                earnings_data = self.get_earnings_data(ticker)
                logger.debug(f"Earnings data keys for {ticker}: {list(earnings_data.keys())}")
                
                # Analyze with AI
                logger.debug(f"Starting AI analysis for {ticker}")
                result = self.analyze_with_ai(ticker, news_data, earnings_data)
                logger.debug(f"AI analysis complete for {ticker}, relevance score: {result.relevance_score}")
                
                results.append(result)
                logger.info(f"Successfully completed research for {ticker}")
                
                # Rate limiting (be respectful to APIs)
                if i < len(tickers):  # Don't sleep after the last ticker
                    logger.debug(f"Rate limiting: sleeping for 2 seconds before next ticker")
                    time.sleep(2)
                
            except Exception as e:
                logger.error(f"Error researching {ticker}: {e}")
                logger.debug(f"Full error details for {ticker}:", exc_info=True)
                
                # Create a basic result even if there's an error
                try:
                    basic_result = ResearchResult(
                        ticker=ticker,
                        title=f"Error Analysis: {ticker}",
                        summary=f"Error occurred during research: {str(e)[:100]}",
                        source='error_fallback',
                        timestamp=datetime.now(),
                        relevance_score=0.1,
                        key_metrics={},
                        trading_insights=[f"Research failed: {str(e)[:50]}"]
                    )
                    results.append(basic_result)
                    logger.info(f"Added error fallback result for {ticker}")
                except Exception as fallback_error:
                    logger.error(f"Even fallback creation failed for {ticker}: {fallback_error}")
                
                continue
        
        logger.info(f"Research complete for all tickers. Total results: {len(results)}")
        return results
    
    def export_results(self, results: List[ResearchResult], format: str = 'csv') -> str:
        """Export results with enhanced data"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        if format == 'csv':
            filename = f'enhanced_research_results_{timestamp}.csv'
            
            data = []
            for result in results:
                data.append({
                    'ticker': result.ticker,
                    'timestamp': result.timestamp,
                    'relevance_score': result.relevance_score,
                    'summary': result.summary,
                    'trading_insights': '; '.join(result.trading_insights),
                    'source_info': result.source,
                    'pe_ratio': result.key_metrics.get('pe_ratio'),
                    'forward_pe': result.key_metrics.get('forward_pe'),
                    'market_cap': result.key_metrics.get('market_cap'),
                    'revenue_growth': result.key_metrics.get('revenue_growth')
                })
            
            df = pd.DataFrame(data)
            df.to_csv(filename, index=False)
            
        else:  # JSON format
            filename = f'enhanced_research_results_{timestamp}.json'
            
            data = []
            for result in results:
                data.append({
                    'ticker': result.ticker,
                    'title': result.title,
                    'summary': result.summary,
                    'timestamp': result.timestamp.isoformat(),
                    'relevance_score': result.relevance_score,
                    'key_metrics': result.key_metrics,
                    'trading_insights': result.trading_insights,
                    'source_info': result.source
                })
            
            with open(filename, 'w') as f:
                json.dump(data, f, indent=2)
        
        logger.info(f"Enhanced results exported to {filename}")
        return filename

