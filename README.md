# Options-Project
This project started as a Python script (`Options code`) that downloads option chains from Yahoo Finance, prices contracts with the Black–Scholes model, computes Greeks, runs payoff simulations, and exports summary tables plus PNG payoff charts. The same quantitative core is now exposed through a lightweight Flask app so you can drive the workflow entirely from the browser.

## Front-end dashboard

The refreshed UI (served from `app.py`) now uses React + Material UI (loaded via CDN) to keep the layout clean and mobile-friendly. It lets you:

- Look up a ticker to fetch the latest spot price and available expirations.
- Pull strike suggestions around the current ATM level with a single click.
- Run the full analysis pipeline without touching the terminal and visualize:
  - Key metrics & Greeks
  - Strategy payoff curves (long call/put, straddle, covered call)
  - Vega/volatility impact
- Get an auto-generated “AI summary” card that condenses the greeks, expected move, and volatility context into a narrative.
- Tap scenario presets (earnings straddle, covered call, protective put), run what-if sliders for spot/vol shifts, and pin alternate setups to compare prices and expected moves.
- Flip between light/dark themes, view recent price action beside the vega curve, and export shareable summaries/JSON snapshots directly from the browser.
- Download the original Excel report plus regenerated PNG charts straight from the page. Assets are stored under `outputs/<TICKER>/<TIMESTAMP>/`.

## Running locally

```bash
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
export FLASK_APP=app.py            # Windows (PowerShell): $env:FLASK_APP="app.py"
flask run
```

Open http://127.0.0.1:5000/ and use the dashboard. The backend still supports the Excel/PNG deliverables, so you can continue sharing reports exactly as before.

## Notes

- The browser makes three API calls: `/api/ticker/<ticker>`, `/api/strikes?ticker=...`, and `/api/analyze`. Feel free to script against those endpoints if you need automation.
- Network access is still required at runtime because the calculations rely on live Yahoo Finance data via `yfinance`.
- The Material UI React build is delivered client-side via CDN + Babel, so no bundler is required. If you later migrate to a dedicated React toolchain, you can drop in a compiled bundle and keep the Flask API as-is.
