#!/usr/bin/env python3
"""
AI-Powered Trading Research System - Enhanced Main Script
"""

import sys
import os
from research_agent import ImprovedResearchAgent
from config import EnhancedConfig

def main():
    """Main execution function"""
    
    print("🤖 Enhanced AI Trading Research System Starting...")
    print("=" * 60)
    
    try:
        # Validate configuration
        EnhancedConfig.validate()
        print("✅ Enhanced configuration validated")
        
        # Initialize the Enhanced Research Agent
        print("📡 Initializing Enhanced Research Agent...")
        agent = ImprovedResearchAgent(
            openai_api_key=EnhancedConfig.OPENAI_API_KEY,
            alpha_vantage_key=EnhancedConfig.ALPHA_VANTAGE_KEY,
            newsapi_key=EnhancedConfig.NEWSAPI_KEY,
            polygon_key=EnhancedConfig.POLYGON_KEY
        )
        print("✅ Enhanced Research Agent initialized with multiple news sources")
        
        # Define tickers to research
        tickers = ["AAPL", "MSFT", "GOOGL", "TSLA"]
        print(f"🎯 Researching tickers: {', '.join(tickers)}")
        
        # Perform research
        print("\n🔍 Starting research process...")
        results = agent.research_tickers(tickers)
        
        # Export results
        print(f"\n📊 Exporting {len(results)} results...")
        csv_file = agent.export_results(results, format='csv')
        json_file = agent.export_results(results, format='json')
        
        print(f"✅ Results exported to:")
        print(f"   📄 CSV: {csv_file}")
        print(f"   📄 JSON: {json_file}")
        
        # Display summary with enhanced metrics
        print(f"\n📈 Enhanced Research Summary:")
        print("=" * 60)
        
        for result in results:
            print(f"\n🏢 {result.ticker}")
            print(f"   📊 Relevance Score: {result.relevance_score:.2f}")
            print(f"   📰 News Sources: {result.source}")
            print(f"   📝 Summary: {result.summary[:80]}{'...' if len(result.summary) > 80 else ''}")
            
            if result.trading_insights and result.trading_insights != ['AI analysis unavailable']:
                print(f"   💡 Key Trading Insights:")
                for i, insight in enumerate(result.trading_insights[:3], 1):  # Show top 3 insights
                    print(f"      {i}. {insight}")
            else:
                print(f"   ⚠️  Limited insights available")
            
            # Show key metrics if available
            metrics = result.key_metrics
            if metrics.get('pe_ratio'):
                print(f"   📈 P/E: {metrics.get('pe_ratio'):.1f} | Market Cap: ${metrics.get('market_cap', 0):,.0f}")
        
        print(f"\n🎉 Enhanced research complete! Check the exported files for detailed results.")
        
        # Enhanced success metrics
        successful_analyses = len([r for r in results if r.trading_insights != ['AI analysis unavailable']])
        total_sources = len(set(r.source for r in results))
        
        print(f"\n📊 Enhanced Success Metrics:")
        print(f"   🎯 AI Insights Success Rate: {successful_analyses}/{len(results)} tickers")
        print(f"   📰 News Sources Utilized: {total_sources} different source types")
        print(f"   🔍 Data Quality: Enhanced with multiple reliable sources")
        
        if successful_analyses == 0:
            print("\n⚠️  No AI insights generated. Please check:")
            print("   1. Your OpenAI API key is correct and has credits")
            print("   2. Your news API keys are working (check API limits)")
            print("   3. Your internet connection is stable")
            print("   4. Try with a single ticker first for debugging")
        elif successful_analyses < len(results):
            print(f"\n💡 To improve success rate:")
            print(f"   1. Get a NewsAPI key for better news quality")
            print(f"   2. Check Alpha Vantage API limits")
            print(f"   3. Some tickers may have limited news coverage")
        else:
            print(f"\n🚀 Excellent! All tickers analyzed successfully with enhanced news sources.")
        
    except ValueError as e:
        print(f"❌ Configuration Error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Unexpected Error: {e}")
        print("\n🔧 Troubleshooting tips:")
        print("   1. Check your internet connection")
        print("   2. Verify your API keys are correct")
        print("   3. Ensure all dependencies are installed")
        sys.exit(1)

if __name__ == "__main__":
    main()