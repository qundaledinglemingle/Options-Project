import os
from datetime import datetime, timedelta

import requests
from flask import Flask, jsonify, render_template, request, send_from_directory

from options_analysis import (
    OUTPUT_ROOT,
    get_nearby_strikes,
    get_spot_and_expirations,
    run_option_analysis,
)

app = Flask(__name__, static_folder="static", template_folder="templates")
FINNHUB_API_KEY = os.environ.get("FINNHUB_API_KEY")
FINNHUB_NEWS_URL = "https://finnhub.io/api/v1/company-news"


def fetch_news_articles(ticker: str, limit: int = 6) -> list:
    if not FINNHUB_API_KEY:
        return []
    end = datetime.utcnow().date()
    start = end - timedelta(days=14)
    params = {
        "symbol": ticker,
        "from": start.isoformat(),
        "to": end.isoformat(),
        "token": FINNHUB_API_KEY,
    }
    resp = requests.get(FINNHUB_NEWS_URL, params=params, timeout=10)
    resp.raise_for_status()
    articles = resp.json()
    formatted = []
    filtered = []
    upper_ticker = ticker.upper()
    for article in articles:
        text = f"{article.get('headline', '')} {article.get('summary', '')}".upper()
        if upper_ticker not in text:
            continue
        filtered.append(article)
        if len(filtered) >= limit:
            break

    for article in filtered:
        formatted.append(
            {
                "title": article.get("headline"),
                "description": article.get("summary"),
                "url": article.get("url"),
                "source": article.get("source"),
                "publishedAt": datetime.utcfromtimestamp(article.get("datetime", 0)).isoformat()
                if article.get("datetime")
                else None,
            }
        )
    return formatted


def fetch_next_earnings(ticker: str):
    if not FINNHUB_API_KEY:
        return None
    start = datetime.utcnow().date()
    end = start + timedelta(days=200)
    params = {
        "symbol": ticker,
        "from": start.isoformat(),
        "to": end.isoformat(),
        "token": FINNHUB_API_KEY,
    }
    resp = requests.get("https://finnhub.io/api/v1/calendar/earnings", params=params, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    events = data.get("earningsCalendar", [])
    for event in events:
        if event.get("symbol", "").upper() != ticker.upper():
            continue
        return {
            "date": event.get("date"),
            "epsEstimate": event.get("epsEstimate"),
            "epsActual": event.get("epsActual"),
            "revenueEstimate": event.get("revenueEstimate"),
            "revenueActual": event.get("revenueActual"),
            "quarter": event.get("quarter"),
            "year": event.get("year"),
        }
    return None


def fetch_earnings_report(ticker: str, limit: int = 4) -> list:
    if not FINNHUB_API_KEY:
        return []
    params = {
        "symbol": ticker,
        "token": FINNHUB_API_KEY,
        "limit": limit,
    }
    resp = requests.get("https://finnhub.io/api/v1/stock/earnings", params=params, timeout=10)
    resp.raise_for_status()
    rows = resp.json()
    report = []
    for row in rows[:limit]:
        report.append(
            {
                "quarter": row.get("quarter"),
                "year": row.get("year"),
                "date": row.get("reportDate"),
                "epsActual": row.get("actual"),
                "epsEstimate": row.get("estimate"),
                "surprise": row.get("surprise"),
                "surprisePercent": row.get("surprisePercent"),
            }
        )
    return report


@app.route("/")
def index():
    return render_template("index.html")


@app.get("/api/ticker/<ticker>")
def api_ticker(ticker: str):
    try:
        data = get_spot_and_expirations(ticker)
        return jsonify(data)
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:  # pragma: no cover - catch-all for API response
        return jsonify({"error": f"Unexpected error: {e}"}), 500


@app.get("/api/strikes")
def api_strikes():
    ticker = request.args.get("ticker", "")
    expiry = request.args.get("expiry", "")
    window = int(request.args.get("window", 3))
    try:
        data = get_nearby_strikes(ticker, expiry, window=window)
        return jsonify(data)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:  # pragma: no cover
        return jsonify({"error": f"Unexpected error: {e}"}), 500


@app.post("/api/analyze")
def api_analyze():
    payload = request.get_json(force=True, silent=True) or {}
    ticker = payload.get("ticker", "").strip().upper()
    expiry = payload.get("expiry", "").strip()
    try:
        r = float(payload.get("riskFreeRate", 0.0))
        K = float(payload.get("strike", 0.0))
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid numeric input."}), 400

    if not ticker or not expiry or not K:
        return jsonify({"error": "Ticker, expiry, and strike are required."}), 400

    try:
        result = run_option_analysis(ticker, r, expiry, K)
        earnings_info = fetch_next_earnings(ticker) if FINNHUB_API_KEY else None
        earnings_report = fetch_earnings_report(ticker) if FINNHUB_API_KEY else []
        conflict = False
        if earnings_info and earnings_info.get("date"):
            conflict = earnings_info["date"] == expiry
        result["earnings"] = {
            "next": earnings_info,
            "conflicts_with_expiry": conflict,
            "recent": earnings_report,
        }
        return jsonify(result)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:  # pragma: no cover
        return jsonify({"error": f"Unexpected error: {e}"}), 500


@app.get("/download/<path:filename>")
def download_file(filename: str):
    target = OUTPUT_ROOT / filename
    if not target.exists():
        return jsonify({"error": "File not found."}), 404
    # Serve relative to OUTPUT_ROOT so only generated assets are exposed
    return send_from_directory(OUTPUT_ROOT, filename, as_attachment=True)


if __name__ == "__main__":
    app.run(debug=True)
@app.get("/api/news/<ticker>")
def api_news(ticker: str):
    if not FINNHUB_API_KEY:
        return jsonify({"articles": [], "warning": "FINNHUB_API_KEY not configured."}), 200
    try:
        articles = fetch_news_articles(ticker.upper())
        return jsonify({"articles": articles})
    except requests.HTTPError as e:
        return jsonify({"error": f"News API error: {e}"}), 502
    except Exception as e:  # pragma: no cover
        return jsonify({"error": f"Unexpected error: {e}"}), 500


@app.get("/api/earnings/<ticker>")
def api_earnings(ticker: str):
    if not FINNHUB_API_KEY:
        return jsonify({"next": None, "warning": "FINNHUB_API_KEY not configured."})
    try:
        next_data = fetch_next_earnings(ticker.upper())
        recent = fetch_earnings_report(ticker.upper())
        return jsonify({"next": next_data, "recent": recent})
    except requests.HTTPError as e:
        return jsonify({"error": f"Earnings API error: {e}"}), 502
    except Exception as e:  # pragma: no cover
        return jsonify({"error": f"Unexpected error: {e}"}), 500
