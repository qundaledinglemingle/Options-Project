from flask import Flask, jsonify, render_template, request, send_from_directory

from options_analysis import (
    OUTPUT_ROOT,
    get_nearby_strikes,
    get_spot_and_expirations,
    run_option_analysis,
)

app = Flask(__name__, static_folder="static", template_folder="templates")


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
