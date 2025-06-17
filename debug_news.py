#!/usr/bin/env python3
"""
Debug script for Enhanced Research Agent
"""

import logging
from research_agent import ImprovedResearchAgent
from config import EnhancedConfig
from datetime import datetime

# Set up detailed logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def debug_single_ticker_enhanced(ticker="AAPL"):
    """Debug research for a single ticker with detailed output"""
    
    print(f"🔍 DEBUG: Testing enhanced research for {ticker}")
    print("=" * 60)
    
    try:
        # Initialize agent
        agent = ImprovedResearchAgent(
            openai_api_key=EnhancedConfig.OPENAI_API_KEY,
            alpha_vantage_key=EnhancedConfig.ALPHA_VANTAGE_KEY,
            newsapi_key=EnhancedConfig.NEWSAPI_KEY,
            polygon_key=EnhancedConfig.POLYGON_KEY
        )
        
        # Get company name
        company_name = agent.get_company_name(ticker)
        print(f"📋 Company name: {company_name}")
        
        # Test each news source separately
        print("\n📰 1. Testing NewsAPI...")
        try:
            newsapi_articles = agent.get_newsapi_articles(ticker, company_name)
            print(f"   ✅ NewsAPI: {len(newsapi_articles)} articles")
            if newsapi_articles:
                sample = newsapi_articles[0]
                print(f"   📄 Sample: {sample.get('title', 'No title')[:60]}...")
                print(f"   🕐 Timestamp: {sample.get('timestamp')} (type: {type(sample.get('timestamp'))})")
        except Exception as e:
            print(f"   ❌ NewsAPI error: {e}")
            logger.exception("NewsAPI debug error:")
        
        print("\n📊 2. Testing Alpha Vantage...")
        try:
            av_articles = agent.get_alpha_vantage_news(ticker)
            print(f"   ✅ Alpha Vantage: {len(av_articles)} articles")
            if av_articles:
                sample = av_articles[0]
                print(f"   📄 Sample: {sample.get('title', 'No title')[:60]}...")
                print(f"   🕐 Timestamp: {sample.get('timestamp')} (type: {type(sample.get('timestamp'))})")
                print(f"   📊 Relevance: {sample.get('relevance_score', 'N/A')}")
        except Exception as e:
            print(f"   ❌ Alpha Vantage error: {e}")
            logger.exception("Alpha Vantage debug error:")
        
        print("\n🌐 3. Testing Finviz...")
        try:
            finviz_articles = agent.get_finviz_news(ticker)
            print(f"   ✅ Finviz: {len(finviz_articles)} articles")
            if finviz_articles:
                sample = finviz_articles[0]
                print(f"   📄 Sample: {sample.get('title', 'No title')[:60]}...")
                print(f"   🕐 Timestamp: {sample.get('timestamp')} (type: {type(sample.get('timestamp'))})")
        except Exception as e:
            print(f"   ❌ Finviz error: {e}")
            logger.exception("Finviz debug error:")
        
        print("\n📈 4. Testing combined news collection...")
        try:
            all_news = agent.get_company_news(ticker)
            print(f"   ✅ Total combined: {len(all_news)} articles")
            
            # Check for timestamp issues
            print("\n🕐 Timestamp analysis:")
            for i, article in enumerate(all_news[:5]):
                timestamp = article.get('timestamp')
                source = article.get('source')
                title = article.get('title', 'No title')[:40]
                print(f"   {i+1}. [{source}] {timestamp} ({type(timestamp)}) - {title}...")
                
                # Check if timestamp is timezone-aware
                if hasattr(timestamp, 'tzinfo') and timestamp.tzinfo is not None:
                    print(f"      ⚠️  TIMEZONE-AWARE timestamp detected from {source}")
                else:
                    print(f"      ✅ Timezone-naive timestamp from {source}")
            
        except Exception as e:
            print(f"   ❌ Combined news error: {e}")
            logger.exception("Combined news debug error:")
        
        print("\n📊 5. Testing earnings data...")
        try:
            earnings_data = agent.get_earnings_data(ticker)
            print(f"   ✅ Earnings data: {list(earnings_data.keys())}")
            metrics = earnings_data.get('key_metrics', {})
            if metrics:
                print(f"   📈 Sample metrics: P/E={metrics.get('pe_ratio')}, Market Cap={metrics.get('market_cap')}")
        except Exception as e:
            print(f"   ❌ Earnings error: {e}")
            logger.exception("Earnings debug error:")
        
        print(f"\n✅ Debug complete for {ticker}")
        
        # Try a full research run
        print(f"\n🚀 6. Testing full research pipeline...")
        try:
            results = agent.research_tickers([ticker])
            print(f"   ✅ Full research: {len(results)} results")
            if results:
                result = results[0]
                print(f"   📊 Result: {result.ticker} - Relevance: {result.relevance_score}")
                print(f"   📝 Summary: {result.summary[:100]}...")
        except Exception as e:
            print(f"   ❌ Full research error: {e}")
            logger.exception("Full research debug error:")
        
    except Exception as e:
        print(f"❌ Debug setup error: {e}")
        logger.exception("Debug setup error:")

if __name__ == "__main__":
    # Test with a single ticker first
    debug_single_ticker_enhanced("AAPL")