import math
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import yfinance as yf

# Always use a non-interactive backend when plotting on the server
plt.switch_backend("Agg")

OUTPUT_ROOT = Path("outputs")
OUTPUT_ROOT.mkdir(exist_ok=True)

NPTS = 201


# === Black-Scholes helpers ===
def norm_pdf(x: float) -> float:
    return (1 / math.sqrt(2 * math.pi)) * math.exp(-0.5 * x * x)


def norm_cdf(x: float) -> float:
    return 0.5 * (1 + math.erf(x / math.sqrt(2)))


def d1(S0: float, K: float, r: float, sigma: float, T: float) -> float:
    return (math.log(S0 / K) + (r + 0.5 * sigma**2) * T) / (sigma * math.sqrt(T))


def d2(S0: float, K: float, r: float, sigma: float, T: float) -> float:
    return d1(S0, K, r, sigma, T) - sigma * math.sqrt(T)


def bs_call(S0: float, K: float, r: float, sigma: float, T: float) -> float:
    D1, D2 = d1(S0, K, r, sigma, T), d2(S0, K, r, sigma, T)
    return S0 * norm_cdf(D1) - K * math.exp(-r * T) * norm_cdf(D2)


def bs_put(S0: float, K: float, r: float, sigma: float, T: float) -> float:
    D1, D2 = d1(S0, K, r, sigma, T), d2(S0, K, r, sigma, T)
    return K * math.exp(-r * T) * norm_cdf(-D2) - S0 * norm_cdf(-D1)


def delta_call(S0: float, K: float, r: float, sigma: float, T: float) -> float:
    return norm_cdf(d1(S0, K, r, sigma, T))


def delta_put(S0: float, K: float, r: float, sigma: float, T: float) -> float:
    return norm_cdf(d1(S0, K, r, sigma, T)) - 1.0


def gamma(S0: float, K: float, r: float, sigma: float, T: float) -> float:
    return norm_pdf(d1(S0, K, r, sigma, T)) / (S0 * sigma * math.sqrt(T))


def vega_perc(S0: float, K: float, r: float, sigma: float, T: float) -> float:
    # per +1% change in vol
    return S0 * norm_pdf(d1(S0, K, r, sigma, T)) * math.sqrt(T) * 0.01


def theta_call_per_year(S0: float, K: float, r: float, sigma: float, T: float) -> float:
    D1, D2 = d1(S0, K, r, sigma, T), d2(S0, K, r, sigma, T)
    return -(S0 * norm_pdf(D1) * sigma) / (2 * math.sqrt(T)) - r * K * math.exp(-r * T) * norm_cdf(D2)


def rho_call(S0: float, K: float, r: float, sigma: float, T: float) -> float:
    return K * T * math.exp(-r * T) * norm_cdf(d2(S0, K, r, sigma, T))


def rho_put(S0: float, K: float, r: float, sigma: float, T: float) -> float:
    return -K * T * math.exp(-r * T) * norm_cdf(-d2(S0, K, r, sigma, T))


# === Payoff helpers ===
def payoff_long_call(ST: np.ndarray, K: float, premium: float) -> np.ndarray:
    return np.maximum(ST - K, 0.0) - premium


def payoff_long_put(ST: np.ndarray, K: float, premium: float) -> np.ndarray:
    return np.maximum(K - ST, 0.0) - premium


def payoff_straddle(ST: np.ndarray, K: float, call_prem: float, put_prem: float) -> np.ndarray:
    return np.maximum(ST - K, 0.0) - call_prem + np.maximum(K - ST, 0.0) - put_prem


def payoff_covered_call(ST: np.ndarray, S0: float, K: float, call_prem: float) -> np.ndarray:
    return (ST - S0) - np.maximum(ST - K, 0.0) + call_prem


def plot_payoff(ST: np.ndarray, y: np.ndarray, title: str, path: Path, vlines: Optional[List[float]] = None) -> None:
    plt.figure()
    plt.plot(ST, y)
    plt.axhline(0, linestyle="--")
    if vlines:
        for x in vlines:
            plt.axvline(x, linestyle=":", linewidth=1)
    plt.title(title)
    plt.xlabel("Stock Price at Expiration (S_T)")
    plt.ylabel("Profit / Loss")
    plt.grid(True)
    plt.savefig(path, dpi=160, bbox_inches="tight")
    plt.close()


def _ticker_obj(ticker: str) -> yf.Ticker:
    ticker = ticker.strip().upper().replace(".", "-")
    if not ticker:
        raise ValueError("Ticker is required.")
    return yf.Ticker(ticker)


def get_spot_and_expirations(ticker: str) -> Dict[str, object]:
    tk = _ticker_obj(ticker)
    hist_today = tk.history(period="1d")["Close"]
    if hist_today.empty:
        raise ValueError("No price data for ticker.")
    S0 = float(hist_today.iloc[-1])
    expiries = tk.options or []
    return {
        "ticker": ticker.upper(),
        "spot": S0,
        "expirations": expiries,
    }


def _option_chain(ticker: str, expiry: str) -> Tuple[yf.Ticker, pd.DataFrame, pd.DataFrame, float]:
    tk = _ticker_obj(ticker)
    hist_today = tk.history(period="1d")["Close"]
    if hist_today.empty:
        raise ValueError("No price data for ticker.")
    S0 = float(hist_today.iloc[-1])

    if not expiry:
        raise ValueError("Expiration is required.")
    chain = tk.option_chain(expiry)
    calls, puts = chain.calls.copy(), chain.puts.copy()
    if calls.empty or puts.empty:
        raise ValueError("Empty option chain for that expiry.")
    return tk, calls, puts, S0


def get_nearby_strikes(ticker: str, expiry: str, window: int = 3) -> Dict[str, object]:
    _, calls, _, S0 = _option_chain(ticker, expiry)
    atm_idx = (calls["strike"] - S0).abs().argmin()
    start = max(0, atm_idx - window)
    end = min(len(calls), atm_idx + window + 1)
    strikes = calls["strike"].iloc[start:end].round(2).tolist()
    return {
        "ticker": ticker.upper(),
        "expiry": expiry,
        "spot": S0,
        "recommended_strikes": strikes,
        "atm_strike": float(calls["strike"].iloc[atm_idx]),
    }


def _time_to_expiry(expiry: str) -> float:
    now = datetime.now(timezone.utc)
    expiry_dt = datetime.fromisoformat(expiry).replace(tzinfo=timezone.utc)
    days = max((expiry_dt - now).total_seconds() / (60 * 60 * 24), 0.0)
    return max(days / 365.0, 1 / 365.0)


def _realized_vol(tk: yf.Ticker) -> float:
    hist = tk.history(period="1y")["Close"].dropna()
    logret = np.log(hist / hist.shift(1)).dropna()
    return float(logret.std() * np.sqrt(252)) if not logret.empty else 0.25


def _recent_history(tk: yf.Ticker, days: int = 90) -> List[Dict[str, float]]:
    hist = tk.history(period="1y")["Close"].dropna()
    if hist.empty:
        return []
    recent = hist.tail(days)
    return [{"date": idx.strftime("%Y-%m-%d"), "close": float(val)} for idx, val in recent.items()]


def _output_dir(ticker: str, timestamp: str) -> Path:
    folder = OUTPUT_ROOT / ticker.upper() / timestamp
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def _percent(value: float) -> str:
    return f"{value * 100:.2f}%"


def _format_money(value: float) -> str:
    return f"${value:,.2f}"


def _build_summary(
    ticker: str,
    S0: float,
    K: float,
    expiry: str,
    days: float,
    call_prem: float,
    put_prem: float,
    sigma: float,
    exp_move_iv_abs: float,
    exp_move_iv_pct: float,
    call_be: float,
    put_be: float,
    delta_c: float,
    delta_p: float,
    gamma_v: float,
    vega_v: float,
) -> str:
    horizon_desc = "very short-dated" if days <= 14 else "near-term" if days <= 45 else "swing-term"
    direction_hint = (
        "bullish tilt (positive delta skew)"
        if delta_c > abs(delta_p)
        else "bearish tilt (put delta dominates)"
    )
    risk_comment = "gamma is elevated, so price sensitivity accelerates quickly" if gamma_v > 0.01 else "gamma is muted, making the position smoother intraday"
    vol_comment = (
        "vega is responsive, so option values will react sharply to volatility shocks"
        if vega_v > 0.2
        else "vega impact is modest; implied vol swings matter less here"
    )
    summary = (
        f"{ticker.upper()} trades around {_format_money(S0)}, and you're evaluating a {horizon_desc} "
        f"{expiry} maturity with strike {_format_money(K)}. "
        f"Black–Scholes prices this call at {_format_money(call_prem)} and the paired put at {_format_money(put_prem)}. "
        f"The implied one-sigma move is roughly {_format_money(exp_move_iv_abs)} ({exp_move_iv_pct:.2f}%), "
        f"placing breakevens near {_format_money(call_be)} on the upside and {_format_money(put_be)} below.\n"
        f"Greeks suggest a {direction_hint}; "
        f"call delta sits around {delta_c:.2f} versus the put at {delta_p:.2f}. "
        f"{risk_comment}, while {vol_comment}. "
        f"With realized volatility near {_percent(sigma)}, plan for potential swings when implieds expand or contract."
    )
    return summary


def run_option_analysis(ticker: str, r: float, expiry: str, K: float) -> Dict[str, object]:
    tk, calls, puts, S0 = _option_chain(ticker, expiry)
    T = _time_to_expiry(expiry)
    days = T * 365
    sigma = _realized_vol(tk)
    history_series = _recent_history(tk)

    call_prem = bs_call(S0, K, r, sigma, T)
    put_prem = bs_put(S0, K, r, sigma, T)

    ST = np.linspace(0, 2 * S0, NPTS)
    long_call = payoff_long_call(ST, K, call_prem)
    long_put = payoff_long_put(ST, K, put_prem)
    straddle = payoff_straddle(ST, K, call_prem, put_prem)
    cov_call = payoff_covered_call(ST, S0, K, call_prem)

    exp_move_iv_abs = S0 * sigma * math.sqrt(T)
    exp_move_iv_pct = exp_move_iv_abs / S0 * 100

    call_intr = max(S0 - K, 0.0)
    put_intr = max(K - S0, 0.0)
    call_time = call_prem - call_intr
    put_time = put_prem - put_intr
    call_be = K + call_prem
    put_be = K - put_prem

    parity_lhs = call_prem + K * math.exp(-r * T)
    parity_rhs = S0 + put_prem
    parity_diff = parity_lhs - parity_rhs

    vols = np.linspace(0.05, 0.60, 40)
    call_vals = [bs_call(S0, K, r, v, T) for v in vols]

    delta_c = delta_call(S0, K, r, sigma, T)
    delta_p = delta_put(S0, K, r, sigma, T)
    gamma_v = gamma(S0, K, r, sigma, T)
    vega_v = vega_perc(S0, K, r, sigma, T)
    theta_v = theta_call_per_year(S0, K, r, sigma, T)
    rho_c = rho_call(S0, K, r, sigma, T)
    rho_p = rho_put(S0, K, r, sigma, T)

    summary_df = pd.DataFrame(
        {
            "Metric": [
                "S0 (Spot)",
                "K (Strike)",
                "r (annual)",
                "T (years)",
                "Call Price",
                "Put Price",
                "Delta (Call)",
                "Delta (Put)",
                "Gamma",
                "Vega% (per 1%)",
                "Theta (Call/yr)",
                "Rho (Call)",
                "Rho (Put)",
                "Expected Move IV ($)",
                "Expected Move IV (%)",
                "Put–Call Parity (lhs - rhs)",
                "Call Intrinsic",
                "Call Time Value",
                "Put Intrinsic",
                "Put Time Value",
                "Call Breakeven",
                "Put Breakeven",
            ],
            "Value": [
                S0,
                K,
                r,
                T,
                call_prem,
                put_prem,
                delta_c,
                delta_p,
                gamma_v,
                vega_v,
                theta_v,
                rho_c,
                rho_p,
                exp_move_iv_abs,
                exp_move_iv_pct,
                parity_diff,
                call_intr,
                call_time,
                put_intr,
                put_time,
                call_be,
                put_be,
            ],
        }
    )

    payoff_df = pd.DataFrame(
        {
            "S_T": ST,
            "Long Call": long_call,
            "Long Put": long_put,
            "Straddle": straddle,
            "Covered Call": cov_call,
        }
    )

    vega_df = pd.DataFrame({"Volatility": vols, "Call Price": call_vals})

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_dir = _output_dir(ticker, timestamp)

    chart_mapping = {
        "long_call": ("Long Call Payoff", long_call, [call_be]),
        "long_put": ("Long Put Payoff", long_put, [put_be]),
        "straddle": (
            "Long Straddle Payoff",
            straddle,
            [K - (call_prem + put_prem), K + (call_prem + put_prem)],
        ),
        "covered_call": ("Covered Call Payoff", cov_call, None),
    }

    for key, (title, values, vlines) in chart_mapping.items():
        plot_payoff(ST, values, title, out_dir / f"{key}.png", vlines=vlines)

    out_xlsx = out_dir / f"{ticker.upper()}_Options_Analysis_Report_{timestamp}.xlsx"
    dfs = {
        "Option Summary": summary_df,
        "Payoff Table": payoff_df,
        "Volatility Impact": vega_df,
    }

    with pd.ExcelWriter(out_xlsx, engine="openpyxl") as w:
        wrote_any = False
        for sheet_name, df in dfs.items():
            if isinstance(df, pd.DataFrame) and not df.empty:
                df.to_excel(w, sheet_name=sheet_name, index=False)
                wrote_any = True
        if not wrote_any:
            pd.DataFrame({"info": ["no data"]}).to_excel(w, sheet_name="Empty", index=False)

    rel_excel = str(out_xlsx.relative_to(OUTPUT_ROOT))
    chart_paths = [
        {"name": name.replace("_", " ").title(), "path": str((out_dir / f"{name}.png").relative_to(OUTPUT_ROOT))}
        for name in chart_mapping.keys()
    ]

    summary_text = _build_summary(
        ticker,
        S0,
        K,
        expiry,
        days,
        call_prem,
        put_prem,
        sigma,
        exp_move_iv_abs,
        exp_move_iv_pct,
        call_be,
        put_be,
        delta_c,
        delta_p,
        gamma_v,
        vega_v,
    )

    return {
        "ticker": ticker.upper(),
        "spot_price": S0,
        "strike": K,
        "risk_free_rate": r,
        "expiry": expiry,
        "time_to_expiry": T,
        "volatility": sigma,
        "expected_move": {"absolute": exp_move_iv_abs, "percent": exp_move_iv_pct},
        "prices": {"call": call_prem, "put": put_prem},
        "breakevens": {"call": call_be, "put": put_be},
        "parity_difference": parity_diff,
        "summary": summary_df.to_dict("records"),
        "summary_text": summary_text,
        "payoff": payoff_df.to_dict("records"),
        "vega_curve": vega_df.to_dict("records"),
        "greeks": {
            "delta_call": delta_c,
            "delta_put": delta_p,
            "gamma": gamma_v,
            "vega_percent": vega_v,
            "theta_call_per_year": theta_v,
            "rho_call": rho_c,
            "rho_put": rho_p,
        },
        "files": {"excel": rel_excel, "charts": chart_paths},
        "recommended_strikes": get_nearby_strikes(ticker, expiry)["recommended_strikes"],
        "history": history_series,
    }


__all__ = [
    "get_spot_and_expirations",
    "get_nearby_strikes",
    "run_option_analysis",
    "OUTPUT_ROOT",
]
