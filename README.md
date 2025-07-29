
# AI News Sentiment Bot – Enhanced Trading Research System

An **AI-powered financial research tool** that aggregates stock market news from multiple reliable sources, analyzes it with OpenAI, and generates **actionable trading insights**.  
The system supports multiple news APIs, fallback sources, and outputs structured results for professional analysis.

---

## 📌 Overview
The **AI News Sentiment Bot** automates:
- **News aggregation** from premium + free sources
- **Sentiment analysis** and summarization via OpenAI
- **Trading insights extraction** from market news and earnings data
- **Exporting results** to CSV/JSON for further analysis

This system is designed for **traders, analysts, and quant developers** who need fast, AI-assisted news intelligence.

---

## 🛠 Tech Stack
- **Language:** Python 3.9+
- **APIs:**  
  - [OpenAI](https://platform.openai.com/) – AI summarization & insights  
  - [NewsAPI](https://newsapi.org/) – Premium news  
  - [Alpha Vantage](https://www.alphavantage.co/) – Sentiment-enabled news  
  - [Polygon.io](https://polygon.io/) (optional) – Premium market data  
  - [Finviz](https://finviz.com/) & [MarketWatch](https://www.marketwatch.com/) – Free stock-specific news  
- **Libraries:** Requests, YFinance, Pandas, BeautifulSoup, Feedparser, Dotenv

---

## ⚡ Features
- ✅ Aggregates news from **multiple prioritized sources** with rate limit handling
- ✅ **OpenAI-powered sentiment and trading insight generation**
- ✅ Automatic **duplicate filtering** across sources
- ✅ Exports structured research results to **CSV & JSON**
- ✅ Includes **error fallback mode** for incomplete API access
- ✅ Supports **configurable API priorities & limits**

---

## 📂 Project Structure
```
ai_news_sentiment_bot/
├── config.py                # EnhancedConfig - API keys & priorities
├── research_agent.py        # ImprovedResearchAgent - core logic
├── main.py                  # Entry point for execution
├── requirements.txt         # Dependencies
└── outputs/                 # Exported research results
```

---

## 🚀 Usage

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Set up API keys  
Create a `.env` file in the project root:
```env
OPENAI_API_KEY=your_openai_key
NEWSAPI_KEY=your_newsapi_key
ALPHA_VANTAGE_KEY=your_alpha_vantage_key
POLYGON_KEY=your_polygon_key   # optional
```

### 3. Run the research
```bash
python main.py
```

The script will:
- Validate configuration
- Collect news from prioritized APIs
- Perform AI analysis
- Export CSV & JSON summaries

---

## 📊 Output
Example CSV/JSON fields:
- `ticker` – Stock symbol analyzed
- `summary` – AI-generated news summary
- `relevance_score` – Confidence rating (0-1)
- `trading_insights` – Actionable insights
- `key_metrics` – PE, Market Cap, Revenue Growth
- `source_info` – News source breakdown

Example console output:
```
🤖 Enhanced AI Trading Research System Starting...
✅ Enhanced configuration validated
📡 Initializing Enhanced Research Agent...
🎯 Researching tickers: AAPL, MSFT, GOOGL, TSLA
📊 Results exported to:
   CSV: enhanced_research_results_20250729.csv
   JSON: enhanced_research_results_20250729.json
🚀 Excellent! All tickers analyzed successfully.
```

---

## 📌 Example Use Cases
- Algorithmic trading strategy validation
- Portfolio monitoring & sentiment tracking
- Pre-earnings market sentiment analysis
- Research automation for analysts

---

## 📄 License
MIT License – Free to use and modify.

---

## 🙋 Author
Developed by Japhet de souza(https://github.com/jaffakakes)  
If you find this useful, please ⭐ the repo!
