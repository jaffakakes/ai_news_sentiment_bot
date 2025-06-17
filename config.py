# Enhanced config.py
import os
from dotenv import load_dotenv

load_dotenv()

class EnhancedConfig:
    """Enhanced Configuration for Better News Sources"""
    
    # Required API Keys
    OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
    
    # News Source API Keys
    ALPHA_VANTAGE_KEY = os.getenv('ALPHA_VANTAGE_KEY')  # Recommended
    NEWSAPI_KEY = os.getenv('NEWSAPI_KEY')  # Highly recommended - sign up at newsapi.org
    POLYGON_KEY = os.getenv('POLYGON_KEY')  # Optional premium source
    
    # News source priorities (when free limits are hit)
    NEWS_SOURCE_PRIORITY = [
        'newsapi',      # Best quality, limited requests
        'alpha_vantage', # Good quality with sentiment
        'finviz',       # Free, stock-specific  
        'marketwatch',  # Free, reliable backup
        'google_news'   # Last resort fallback
    ]
    
    # Rate limiting and usage
    RATE_LIMIT_DELAY = 2  # More conservative for multiple APIs
    MAX_NEWS_ARTICLES_PER_SOURCE = 10
    MAX_TOTAL_NEWS_ARTICLES = 20
    
    @classmethod
    def validate(cls):
        """Validate configuration and show available sources"""
        errors = []
        available_sources = []
        
        if not cls.OPENAI_API_KEY:
            errors.append("OPENAI_API_KEY is required")
        else:
            available_sources.append("✅ OpenAI (AI analysis)")
        
        # Check news sources
        if cls.NEWSAPI_KEY:
            available_sources.append("✅ NewsAPI (premium news)")
        else:
            available_sources.append("❌ NewsAPI (get free key at newsapi.org)")
            
        if cls.ALPHA_VANTAGE_KEY:
            available_sources.append("✅ Alpha Vantage (sentiment news)")
        else:
            available_sources.append("❌ Alpha Vantage (free tier available)")
            
        available_sources.append("✅ Finviz (free stock news)")
        available_sources.append("✅ MarketWatch (free RSS)")
        available_sources.append("✅ Google News (fallback)")
        
        if errors:
            raise ValueError("Configuration errors:\n" + "\n".join(f"- {error}" for error in errors))
        
        print("📰 Available News Sources:")
        for source in available_sources:
            print(f"   {source}")
        
        # Calculate expected daily capacity
        daily_capacity = 0
        if cls.NEWSAPI_KEY:
            daily_capacity += 100  # NewsAPI free tier
        if cls.ALPHA_VANTAGE_KEY:
            daily_capacity += 500  # Alpha Vantage free tier
        daily_capacity += 1000  # Unlimited free sources (Finviz, MarketWatch, Google)
        
        print(f"\n📊 Estimated Daily Capacity: {daily_capacity}+ news requests")
        print(f"📈 Recommended Daily Tickers: {min(daily_capacity // 4, 50)} tickers")
        
        return True

# Validate on import
try:
    EnhancedConfig.validate()
    print("✅ Enhanced configuration validated successfully")
except ValueError as e:
    print(f"❌ Configuration Error: {e}")