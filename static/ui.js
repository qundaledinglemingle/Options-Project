const {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Container,
  Box,
  AppBar,
  Toolbar,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  Chip,
  Stack,
  Divider,
  Alert,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Fade,
  Grow,
  LinearProgress,
  Switch,
  Slider,
  Tooltip,
  Collapse,
  IconButton,
} = MaterialUI;

const buildTheme = (mode) =>
  createTheme({
    palette: {
      mode,
      primary: { main: mode === "dark" ? "#60a5fa" : "#2563eb" },
      secondary: { main: mode === "dark" ? "#f472b6" : "#db2777" },
      background: {
        default: mode === "dark" ? "#020617" : "#f7fafc",
        paper: mode === "dark" ? "rgba(15,23,42,0.92)" : "#ffffff",
      },
    },
    typography: {
      fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    },
    shape: {
      borderRadius: 18,
    },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage:
              mode === "dark"
                ? "linear-gradient(135deg, rgba(15,23,42,0.95), rgba(15,23,42,0.7))"
                : "linear-gradient(135deg, rgba(255,255,255,0.98), rgba(248,250,252,0.9))",
            border: mode === "dark" ? "1px solid rgba(148,163,184,0.18)" : "1px solid rgba(15,23,42,0.05)",
            boxShadow: mode === "dark" ? "0 25px 70px rgba(2,6,23,0.6)" : "0 12px 40px rgba(15,23,42,0.08)",
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 999,
            textTransform: "none",
            fontWeight: 600,
          },
        },
      },
    },
  });

const STRATEGIES = [
  {
    key: "Long Call",
    color: "#60a5fa",
    accent: "#1d4ed8",
    description: "Unlimited upside with defined premium risk.",
  },
  {
    key: "Long Put",
    color: "#34d399",
    accent: "#065f46",
    description: "Downside hedge that profits when price drops.",
  },
  {
    key: "Straddle",
    color: "#f97316",
    accent: "#9a3412",
    description: "Volatility play that needs a big move either way.",
  },
  {
    key: "Covered Call",
    color: "#f472b6",
    accent: "#9d174d",
    description: "Income strategy capped above the strike.",
  },
];

const PRESETS = [
  {
    label: "Earnings Straddle",
    description: "Nearest expiry, ATM strike, higher vol focus.",
    strikeOffset: 0,
    volBump: 5,
    expiryPreference: "7d",
  },
  {
    label: "Covered Call",
    description: "30-45d tenor, +5% OTM strike.",
    strikeOffset: 0.05,
    expiryPreference: "30d",
  },
  {
    label: "Protective Put",
    description: "1-2 month tenor, ATM protection.",
    strikeOffset: 0,
    expiryPreference: "60d",
  },
];

const formatNumber = (value, decimals = 2) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return Number(value).toFixed(decimals);
};

const formatCurrency = (value, decimals = 2) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return `$${Number(value).toFixed(decimals)}`;
};

const fetchJSON = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
};

const StatusAlert = ({ status }) => {
  if (!status.message) return null;
  return (
    <Fade in>
      <Alert severity={status.severity} sx={{ mt: 2 }}>
        {status.message}
      </Alert>
    </Fade>
  );
};

const MetricCard = ({ label, value }) => (
  <Card
    sx={{
      background: "linear-gradient(135deg, rgba(96,165,250,0.25), rgba(14,165,233,0.08))",
      border: "1px solid rgba(96,165,250,0.4)",
      backdropFilter: "blur(12px)",
    }}
  >
    <CardContent>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        {label}
      </Typography>
      <Typography variant="h5" fontWeight={700}>
        {value}
      </Typography>
    </CardContent>
  </Card>
);

const useChart = (canvasRef, configBuilder, deps = []) => {
  React.useEffect(() => {
    if (!canvasRef.current) return undefined;
    const config = configBuilder(canvasRef.current);
    if (!config) return undefined;
    const chart = new Chart(canvasRef.current, config);
    return () => chart.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
};

const StrategyChart = ({ rows, strategy, color }) => {
  const canvasRef = React.useRef(null);
  useChart(
    canvasRef,
    () => {
      if (!rows || !rows.length) return null;
      return {
        type: "line",
        data: {
          labels: rows.map((row) => Number(row.S_T)),
          datasets: [
            {
              data: rows.map((row) => Number(row[strategy])),
              borderColor: color,
              backgroundColor: `${color}33`,
              fill: true,
              tension: 0.25,
              borderWidth: 2.5,
              pointRadius: 0,
            },
          ],
        },
        options: {
          maintainAspectRatio: false,
          scales: {
            x: {
              display: false,
            },
            y: {
              ticks: { maxTicksLimit: 4, color: "#94a3b8" },
              grid: { color: "rgba(148,163,184,0.12)" },
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => `$${ctx.parsed.y.toFixed(2)}`,
              },
            },
          },
        },
      };
    },
    [rows, strategy, color]
  );
  return <canvas ref={canvasRef} style={{ width: "100%", height: 160 }} />;
};

const StrategyCard = ({ cfg, rows, index }) => (
  <Grow in timeout={500 + index * 100}>
    <Card
      sx={{
        height: "100%",
        position: "relative",
        overflow: "hidden",
        background: `linear-gradient(145deg, rgba(15,23,42,0.95), rgba(15,23,42,0.75))`,
      }}
    >
      <CardContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="subtitle1" fontWeight={600}>
            {cfg.key}
          </Typography>
          <Chip
            label="Payoff"
            size="small"
            sx={{
              backgroundColor: `${cfg.color}22`,
              borderColor: `${cfg.color}55`,
              color: cfg.color,
            }}
            variant="outlined"
          />
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {cfg.description}
        </Typography>
        <Box sx={{ height: 180 }}>
          <StrategyChart rows={rows} strategy={cfg.key} color={cfg.color} />
        </Box>
      </CardContent>
    </Card>
  </Grow>
);

const HistoryChart = ({ history, mode }) => {
  const canvasRef = React.useRef(null);
  useChart(
    canvasRef,
    () => {
      if (!history || !history.length) return null;
      return {
        type: "line",
        data: {
          labels: history.map((row) => row.date),
          datasets: [
            {
              data: history.map((row) => row.close),
              borderColor: mode === "dark" ? "#22d3ee" : "#0369a1",
              borderWidth: 2.5,
              fill: true,
              backgroundColor: mode === "dark" ? "rgba(34,211,238,0.15)" : "rgba(3,105,161,0.15)",
              pointRadius: 0,
              tension: 0.25,
            },
          ],
        },
        options: {
          maintainAspectRatio: false,
          scales: {
            x: { ticks: { maxTicksLimit: 6, color: "#94a3b8" }, grid: { display: false } },
            y: { ticks: { maxTicksLimit: 4, color: "#94a3b8" }, grid: { color: "rgba(148,163,184,0.12)" } },
          },
          plugins: { legend: { display: false } },
        },
      };
    },
    [history, mode]
  );
  return <canvas ref={canvasRef} style={{ width: "100%", height: 160 }} />;
};

const SensitivityCard = ({ result, spotShift, setSpotShift, volShift, setVolShift }) => {
  const derived = React.useMemo(() => {
    if (!result || !result.greeks || !result.prices) return null;
    const spot = result.spot_price;
    const dS = spot * (spotShift / 100);
    const volChange = volShift / 100;
    const gammaAdj = 0.5 * result.greeks.gamma * dS * dS;
    const callPrice =
      result.prices.call + result.greeks.delta_call * dS + gammaAdj + result.greeks.vega_percent * volShift;
    const putPrice =
      result.prices.put + result.greeks.delta_put * dS + gammaAdj + result.greeks.vega_percent * volShift;
    const newSpot = spot + dS;
    const newSigma = Math.max(0.05, result.volatility + volChange);
    const newExpectedMove = newSpot * newSigma * Math.sqrt(result.time_to_expiry || 0);
    return {
      newSpot,
      callPrice,
      putPrice,
      newExpectedMove,
      newCallBE: result.strike + callPrice,
      newPutBE: result.strike - putPrice,
    };
  }, [result, spotShift, volShift]);

  if (!result) return null;

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={3} alignItems="center" justifyContent="space-between">
        <Box flex={1}>
          <Typography variant="h6">Sensitivity Sandbox</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Slide spot or implied volatility to see approximate price shifts using delta/gamma/vega.
          </Typography>
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Spot shift
            </Typography>
            <Slider
              min={-10}
              max={10}
              step={0.5}
              value={spotShift}
              onChange={(_, value) => setSpotShift(Array.isArray(value) ? value[0] : value)}
              valueLabelDisplay="auto"
            />
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Volatility shift (pts)
            </Typography>
            <Slider
              min={-10}
              max={10}
              step={0.5}
              value={volShift}
              onChange={(_, value) => setVolShift(Array.isArray(value) ? value[0] : value)}
              valueLabelDisplay="auto"
            />
          </Box>
        </Box>
        {derived && (
          <Grid container spacing={2} flex={1}>
            <Grid item xs={6}>
              <MetricCard label="Simulated Spot" value={formatCurrency(derived.newSpot)} />
            </Grid>
            <Grid item xs={6}>
              <MetricCard label="Call Price" value={formatCurrency(derived.callPrice)} />
            </Grid>
            <Grid item xs={6}>
              <MetricCard label="Put Price" value={formatCurrency(derived.putPrice)} />
            </Grid>
            <Grid item xs={6}>
              <MetricCard label="Expected Move" value={formatCurrency(derived.newExpectedMove)} />
            </Grid>
          </Grid>
        )}
      </Stack>
    </Paper>
  );
};

const ComparisonBoard = ({ base, comparisons, onRemove }) => {
  if (!base || !comparisons.length) return null;
  const formatDiff = (value, baseValue) => {
    const diff = value - baseValue;
    const sign = diff >= 0 ? "+" : "";
    return `${formatCurrency(value)} (${sign}${diff.toFixed(2)})`;
  };
  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6">Pinned Comparisons</Typography>
        <Typography variant="body2" color="text.secondary">
          Base: {base.ticker} {base.expiry}
        </Typography>
      </Stack>
      <Grid container spacing={2}>
        {comparisons.map((item) => (
          <Grid item xs={12} md={6} key={item.key}>
            <Card>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="subtitle1">
                    {item.ticker} • {item.expiry}
                  </Typography>
                  <Button size="small" onClick={() => onRemove(item.key)}>
                    Remove
                  </Button>
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Strike {formatCurrency(item.strike)} | r={formatNumber(item.risk_free_rate, 3)}
                </Typography>
                <Typography variant="body2">
                  Call {formatDiff(item.prices.call, base.prices.call)} • Put {formatDiff(item.prices.put, base.prices.put)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Expected Move {formatDiff(item.expected_move.absolute, base.expected_move.absolute)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Paper>
  );
};

const ExportCenter = ({ result }) => {
  const [copied, setCopied] = React.useState(false);
  if (!result) return null;

  const copySummary = async () => {
    if (!result.summary_text) return;
    try {
      await navigator.clipboard.writeText(result.summary_text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Clipboard error", error); // eslint-disable-line no-console
    }
  };

  const downloadJSON = () => {
    const payload = {
      ticker: result.ticker,
      expiry: result.expiry,
      strike: result.strike,
      summary: result.summary_text,
      greeks: result.greeks,
      expected_move: result.expected_move,
      timestamp: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${result.ticker}_${result.expiry}_summary.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Export Center
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Share key insights without re-running the model.
      </Typography>
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        <Button variant="contained" onClick={copySummary}>
          {copied ? "Copied!" : "Copy Summary"}
        </Button>
        <Button variant="outlined" onClick={downloadJSON}>
          Download Snapshot
        </Button>
      </Stack>
    </Paper>
  );
};

const VegaChart = ({ rows }) => {
  const canvasRef = React.useRef(null);
  useChart(
    canvasRef,
    () => {
      if (!rows || !rows.length) return null;
      return {
        type: "line",
        data: {
          labels: rows.map((row) => Number(row.Volatility)),
          datasets: [
            {
              label: "Call Price vs Volatility",
              data: rows.map((row) => Number(row["Call Price"])),
              borderColor: "#a855f7",
              tension: 0.2,
              borderWidth: 3,
              pointRadius: 0,
            },
          ],
        },
        options: {
          maintainAspectRatio: false,
          scales: {
            x: {
              ticks: { maxTicksLimit: 5, color: "#94a3b8" },
              grid: { color: "rgba(148,163,184,0.15)" },
              title: { display: true, text: "Volatility" },
            },
            y: {
              ticks: { maxTicksLimit: 5, color: "#94a3b8" },
              grid: { color: "rgba(148,163,184,0.15)" },
              title: { display: true, text: "Call Price" },
            },
          },
          plugins: {
            legend: { display: false },
          },
        },
      };
    },
    [rows]
  );
  return <canvas ref={canvasRef} style={{ width: "100%", height: 320 }} />;
};

const Downloads = ({ files }) => {
  if (!files) return null;
  const links = [];
  if (files.excel) {
    links.push({ label: "Excel Report", path: files.excel });
  }
  (files.charts || []).forEach((chart) => {
    links.push({ label: chart.name || "Chart", path: chart.path });
  });

  if (!links.length) return null;

  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      {links.map((item) => (
        <Button
          key={item.path}
          variant="outlined"
          color="secondary"
          size="small"
          component="a"
          href={`/download/${item.path}`}
          target="_blank"
          rel="noopener"
          sx={{ textTransform: "none" }}
        >
          {item.label}
        </Button>
      ))}
    </Stack>
  );
};

const SummaryTable = ({ rows }) => {
  if (!rows || !rows.length) return null;
  return (
    <TableContainer component={Paper} sx={{ backgroundColor: "rgba(15,23,42,0.6)" }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Metric</TableCell>
            <TableCell align="right">Value</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.Metric}>
              <TableCell>{row.Metric}</TableCell>
              <TableCell align="right">{formatNumber(row.Value, 4)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

const NarrativeCard = ({ text }) => {
  const [displayText, setDisplayText] = React.useState("");
  React.useEffect(() => {
    if (!text) return undefined;
    setDisplayText("");
    let idx = 0;
    const interval = setInterval(() => {
      idx += 2;
      setDisplayText(text.slice(0, idx));
      if (idx >= text.length) {
        clearInterval(interval);
      }
    }, 20);
    return () => clearInterval(interval);
  }, [text]);
  if (!text) return null;
  return (
    <Paper
      sx={{
        p: 3,
        position: "relative",
        overflow: "hidden",
        background: "linear-gradient(135deg, rgba(15,23,42,0.95), rgba(6,11,23,0.9))",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(circle at top right, rgba(96,165,250,0.2), transparent 55%)",
          opacity: 0.6,
          pointerEvents: "none",
        }}
      />
      <Stack spacing={1} sx={{ position: "relative" }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h6">AI Summary</Typography>
          <Chip size="small" label="beta" color="secondary" variant="outlined" />
        </Stack>
        <Typography variant="body2" color="text.secondary">
          Generated from the modeled Greeks, volatility, and payoff profile.
        </Typography>
        {!displayText && <LinearProgress color="secondary" sx={{ mt: 2 }} />}
        <Typography
          sx={{
            mt: 1,
            fontSize: "1rem",
            lineHeight: 1.6,
            whiteSpace: "pre-line",
          }}
        >
          {displayText || text}
        </Typography>
      </Stack>
    </Paper>
  );
};

const NewsPanel = ({ articles, warning }) => {
  if (warning) {
    return <Alert severity="info" sx={{ mt: 2 }}>{warning}</Alert>;
  }
  if (!articles || !articles.length) return null;
  return (
    <Stack spacing={2} sx={{ mt: 2 }}>
      {articles.map((article) => (
        <Box
          key={`${article.title}-${article.publishedAt}`}
          sx={{
            border: "1px solid rgba(148,163,184,0.15)",
            borderRadius: 2,
            p: 2,
            background: "rgba(30,41,59,0.2)",
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="baseline">
            <Typography variant="subtitle1">{article.title}</Typography>
            {article.source && (
              <Typography variant="caption" color="text.secondary">
                {article.source}
              </Typography>
            )}
          </Stack>
          {article.description && (
            <Typography variant="body2" color="text.secondary" sx={{ my: 1 }}>
              {article.description}
            </Typography>
          )}
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            {article.publishedAt && (
              <Typography variant="caption" color="text.secondary">
                {new Date(article.publishedAt).toLocaleString()}
              </Typography>
            )}
            {article.url && (
              <Button size="small" href={article.url} target="_blank" rel="noopener" variant="text">
                Read article
              </Button>
            )}
          </Stack>
        </Box>
      ))}
    </Stack>
  );
};

const EarningsPanel = ({ data, report, loading, warning, conflict }) => {
  if (loading) {
    return <LinearProgress sx={{ mt: 1 }} />;
  }
  if (warning) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        {warning}
      </Typography>
    );
  }
  return (
    <Stack spacing={1} sx={{ mt: 1 }}>
      {data ? (
        <>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body1" fontWeight={600}>
              {data.date}
            </Typography>
            {conflict && <Chip size="small" color="warning" label="Matches expiry" />}
          </Stack>
          <Typography variant="body2" color="text.secondary">
            EPS est: {formatNumber(data.epsEstimate, 2)}{" "}
            {data.epsActual ? `• EPS actual: ${formatNumber(data.epsActual, 2)}` : ""}
          </Typography>
          {data.revenueEstimate && (
            <Typography variant="body2" color="text.secondary">
              Revenue est: {formatNumber(data.revenueEstimate, 2)}B
            </Typography>
          )}
          {data.quarter && data.year && (
            <Typography variant="caption" color="text.secondary">
              {data.quarter}Q{String(data.year).slice(-2)}
            </Typography>
          )}
        </>
      ) : (
        <Typography variant="body2" color="text.secondary">
          No upcoming earnings found.
        </Typography>
      )}
      {!!(report && report.length) && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="body2" fontWeight={600} gutterBottom>
            Recent quarters
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Quarter</TableCell>
                <TableCell align="right">EPS (Actual)</TableCell>
                <TableCell align="right">EPS (Est)</TableCell>
                <TableCell align="right">Surprise %</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {report.map((row) => (
                <TableRow key={`${row.year}-${row.quarter}`}>
                  <TableCell>{row.quarter}Q{String(row.year).slice(-2)}</TableCell>
                  <TableCell align="right">{formatNumber(row.epsActual, 2)}</TableCell>
                  <TableCell align="right">{formatNumber(row.epsEstimate, 2)}</TableCell>
                  <TableCell align="right">{formatNumber(row.surprisePercent, 2)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
    </Stack>
  );
};

const OptionsDashboard = () => {
  const [themeMode, setThemeMode] = React.useState("dark");
  const theme = React.useMemo(() => buildTheme(themeMode), [themeMode]);
  const [ticker, setTicker] = React.useState("AAPL");
  const [riskFreeRate, setRiskFreeRate] = React.useState(0.045);
  const [expirations, setExpirations] = React.useState([]);
  const [expiry, setExpiry] = React.useState("");
  const [strike, setStrike] = React.useState("");
  const [suggestions, setSuggestions] = React.useState([]);
  const [spot, setSpot] = React.useState(null);
  const [status, setStatus] = React.useState({ message: "", severity: "info" });
  const [loadingTicker, setLoadingTicker] = React.useState(false);
  const [loadingStrikes, setLoadingStrikes] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  const [result, setResult] = React.useState(null);
  const [comparisons, setComparisons] = React.useState([]);
  const [news, setNews] = React.useState({ articles: [], warning: "", loading: false });
  const [earnings, setEarnings] = React.useState({ data: null, report: [], warning: "", loading: false });
  const [spotShift, setSpotShift] = React.useState(0);
  const [volShift, setVolShift] = React.useState(0);
  const [sectionsExpanded, setSectionsExpanded] = React.useState({
    strategies: true,
    charts: true,
    news: true,
  });

  const selectExpiryByPreference = React.useCallback(
    (preference) => {
      if (!expirations.length) return "";
      const targetMap = { "7d": 7, "30d": 35, "60d": 60 };
      const targetDays = targetMap[preference] || 7;
      const now = new Date();
      let best = expirations[0];
      let minDiff = Infinity;
      expirations.forEach((exp) => {
        const diffDays = (new Date(`${exp}T00:00:00Z`).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        const absDiff = Math.abs(diffDays - targetDays);
        if (absDiff < minDiff) {
          minDiff = absDiff;
          best = exp;
        }
      });
      return best;
    },
    [expirations]
  );

  const applyPreset = (preset) => {
    if (!spot) {
      setStatusMessage("Load a ticker first, then choose a preset.", "warning");
      return;
    }
    if (preset.expiryPreference) {
      const expChoice = selectExpiryByPreference(preset.expiryPreference);
      if (expChoice) setExpiry(expChoice);
    } else if (expirations.length) {
      setExpiry(expirations[0]);
    }
    const offset = preset.strikeOffset || 0;
    setStrike((spot * (1 + offset)).toFixed(2));
    if (typeof preset.volBump === "number") {
      setVolShift(Math.max(-10, Math.min(10, preset.volBump)));
    }
    setStatusMessage(`Preset "${preset.label}" applied.`, "success");
  };

  const handlePinResult = () => {
    if (!result) return;
    const key = `${result.ticker}-${result.expiry}-${result.strike}-${Date.now()}`;
    const snapshot = {
      key,
      ticker: result.ticker,
      expiry: result.expiry,
      strike: result.strike,
      expected_move: result.expected_move,
      prices: result.prices,
      risk_free_rate: result.risk_free_rate,
    };
    setComparisons((prev) => {
      const next = [snapshot, ...prev].slice(0, 3);
      return next;
    });
    setStatusMessage("Pinned current configuration for comparison.", "success");
  };

  const removeComparison = (key) => {
    setComparisons((prev) => prev.filter((item) => item.key !== key));
  };

  const setStatusMessage = (message, severity = "info") => {
    setStatus({ message, severity });
  };

  const loadTickerData = async () => {
    const symbol = ticker.trim().toUpperCase();
    if (!symbol) {
      setStatusMessage("Enter a ticker symbol.", "warning");
      return;
    }
    setLoadingTicker(true);
    setStatusMessage(`Loading ${symbol}...`, "info");
    try {
      const data = await fetchJSON(`/api/ticker/${symbol}`);
      setSpot(data.spot);
      setExpirations(data.expirations || []);
      setExpiry("");
      setStrike("");
      setSuggestions([]);
      setResult(null);
      loadNews(symbol);
      loadEarnings(symbol);
      setStatusMessage(
        `Loaded ${data.ticker}. Choose an expiration and strike to proceed.`,
        "success"
      );
    } catch (error) {
      setStatusMessage(error.message, "error");
    } finally {
      setLoadingTicker(false);
    }
  };

  const loadNews = async (symbol) => {
    setNews((prev) => ({ ...prev, loading: true }));
    try {
      const data = await fetchJSON(`/api/news/${symbol}`);
      setNews({ articles: data.articles || [], warning: data.warning, loading: false });
    } catch (error) {
      setNews({ articles: [], warning: error.message, loading: false });
    }
  };

  const loadEarnings = async (symbol) => {
    setEarnings({ data: null, warning: "", loading: true });
    try {
      const data = await fetchJSON(`/api/earnings/${symbol}`);
      setEarnings({
        data: data.next || null,
        report: data.recent || [],
        warning: data.warning || "",
        loading: false,
      });
    } catch (error) {
      setEarnings({ data: null, warning: error.message, loading: false });
    }
  };

  const loadStrikeSuggestions = async (selectedExpiry) => {
    if (!ticker || !selectedExpiry) return;
    setLoadingStrikes(true);
    setStatusMessage("Fetching nearby strikes...", "info");
    try {
      const data = await fetchJSON(
        `/api/strikes?ticker=${ticker.trim().toUpperCase()}&expiry=${selectedExpiry}`
      );
      setSuggestions(data.recommended_strikes || []);
      setSpot(data.spot);
      if (!strike && data.atm_strike) {
        setStrike(Number(data.atm_strike).toFixed(2));
      }
      setStatusMessage("Strike suggestions updated.", "success");
    } catch (error) {
      setStatusMessage(error.message, "error");
    } finally {
      setLoadingStrikes(false);
    }
  };

  const handleExpiryChange = (event) => {
    const value = event.target.value;
    setExpiry(value);
    setStrike("");
    if (value) {
      loadStrikeSuggestions(value);
    } else {
      setSuggestions([]);
    }
  };

  const runAnalysis = async () => {
    if (!ticker || !expiry || !strike) {
      setStatusMessage("Ticker, expiration, and strike are required.", "warning");
      return;
    }
    setRunning(true);
    setStatusMessage("Running analysis...", "info");
    try {
      const payload = {
        ticker: ticker.trim().toUpperCase(),
        expiry,
        strike: Number(strike),
        riskFreeRate: Number(riskFreeRate),
      };
      const data = await fetchJSON("/api/analyze", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setResult(data);
      setStatusMessage("Analysis complete.", "success");
    } catch (error) {
      setStatusMessage(error.message, "error");
    } finally {
      setRunning(false);
    }
  };

  React.useEffect(() => {
    loadTickerData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    setSpotShift(0);
    setVolShift(0);
  }, [result]);

  const toggleSection = (section) => {
    setSectionsExpanded((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const metricData = React.useMemo(() => {
    if (!result) return [];
    return [
      { label: "Spot", value: formatCurrency(result.spot_price) },
      { label: "Strike", value: formatCurrency(result.strike) },
      { label: "Expected Move ($)", value: formatCurrency(result.expected_move.absolute) },
      { label: "Expected Move (%)", value: `${formatNumber(result.expected_move.percent)}%` },
      { label: "Call Breakeven", value: formatCurrency(result.breakevens.call) },
      { label: "Put Breakeven", value: formatCurrency(result.breakevens.put) },
    ];
  }, [result]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="static" elevation={0} sx={{ background: "rgba(15,23,42,0.8)", backdropFilter: "blur(16px)" }}>
        <Toolbar sx={{ gap: 2, py: 1.5 }}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Options Analysis Dashboard
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" color="text.secondary">
              {themeMode === "dark" ? "Dark Mode" : "Light Mode"}
            </Typography>
            <Switch
              checked={themeMode === "dark"}
              onChange={(event) => setThemeMode(event.target.checked ? "dark" : "light")}
            />
          </Stack>
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, minHeight: "100%", backgroundColor: "rgba(15,23,42,0.85)" }}>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Configure Trade
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Pull live option data, choose expirations, and run the original analytics engine with a single click.
                  </Typography>
                </Box>
                <Divider light />
                <TextField
                  label="Ticker"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  InputProps={{ sx: { textTransform: "uppercase" } }}
                />
                <Button
                  variant="contained"
                  onClick={loadTickerData}
                  disabled={loadingTicker}
                  startIcon={
                    loadingTicker ? (
                      <CircularProgress size={18} color="inherit" />
                    ) : undefined
                  }
                >
                  {loadingTicker ? "Loading…" : "Load Expirations"}
                </Button>
                <TextField
                  label="Risk-Free Rate (annual)"
                  type="number"
                  value={riskFreeRate}
                  onChange={(e) => setRiskFreeRate(e.target.value)}
                  inputProps={{ step: 0.0001 }}
                />
                <Box>
                  <TextField
                    label="Expiration"
                    select
                    value={expiry}
                    onChange={handleExpiryChange}
                    SelectProps={{ native: true }}
                    InputLabelProps={{ shrink: true }}
                    disabled={!expirations.length}
                  >
                    <option value="">Select an expiration</option>
                    {expirations.map((date) => (
                      <option key={date} value={date}>
                        {date}
                      </option>
                    ))}
                  </TextField>
                  {earnings.data?.date && expiry && earnings.data.date === expiry && (
                    <Alert severity="warning" sx={{ mt: 1 }}>
                      This expiration lands on the next earnings date.
                    </Alert>
                  )}
                </Box>
                <TextField
                  label="Strike"
                  type="number"
                  value={strike}
                  onChange={(e) => setStrike(e.target.value)}
                  placeholder="Choose from suggestions"
                />
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {loadingStrikes && <CircularProgress size={18} />}
                  {!loadingStrikes &&
                    suggestions.map((value) => (
                      <Chip
                        key={value}
                        label={formatNumber(value)}
                        color={Number(strike) === Number(value) ? "primary" : "default"}
                        onClick={() => setStrike(Number(value).toFixed(2))}
                        sx={{ cursor: "pointer" }}
                      />
                    ))}
                </Stack>
                <Divider light />
                <Stack spacing={1}>
                  <Typography variant="subtitle2">Scenario presets</Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {PRESETS.map((preset) => (
                      <Tooltip key={preset.label} title={preset.description}>
                        <Chip label={preset.label} variant="outlined" onClick={() => applyPreset(preset)} />
                      </Tooltip>
                    ))}
                  </Stack>
                </Stack>
                <Button
                  variant="contained"
                  color="secondary"
                  onClick={runAnalysis}
                  disabled={running}
                  startIcon={
                    running ? <CircularProgress size={18} color="inherit" /> : undefined
                  }
                >
                  {running ? "Crunching…" : "Run Analysis"}
                </Button>
                <Divider light />
                <Box>
                  <Typography variant="subtitle2">Next earnings</Typography>
                  <EarningsPanel
                    data={earnings.data}
                    report={earnings.report}
                    loading={earnings.loading}
                    warning={earnings.warning}
                    conflict={earnings.data?.date && earnings.data.date === expiry}
                  />
                </Box>
                <StatusAlert status={status} />
              </Stack>
            </Paper>
          </Grid>

          {result && (
            <Grid item xs={12} md={8}>
              <Fade in timeout={500}>
                <Stack spacing={3}>
                <Paper sx={{ p: 3 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6">Snapshot</Typography>
                    <Button variant="outlined" size="small" onClick={handlePinResult}>
                      Pin This Setup
                    </Button>
                  </Stack>
                  <Grid container spacing={2}>
                    {metricData.map((metric, idx) => (
                      <Grid item xs={12} sm={6} md={4} key={metric.label}>
                        <Grow in timeout={400 + idx * 120}>
                          <div>
                            <MetricCard label={metric.label} value={metric.value} />
                          </div>
                        </Grow>
                      </Grid>
                    ))}
                  </Grid>
                  {result.earnings?.conflicts_with_expiry && (
                    <Alert severity="warning" sx={{ mt: 2 }}>
                      Your chosen expiration {result.expiry} lines up with the next earnings date (
                      {result.earnings?.next?.date}). Expect elevated volatility.
                    </Alert>
                  )}
                </Paper>

                <SensitivityCard
                  result={result}
                  spotShift={spotShift}
                  setSpotShift={setSpotShift}
                  volShift={volShift}
                  setVolShift={setVolShift}
                />

                <Paper sx={{ p: 3 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="h6">Strategy Playbooks</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Each payoff card isolates a single strategy so you can compare convexity and breakevens independently.
                      </Typography>
                    </Box>
                    <Button size="small" onClick={() => toggleSection("strategies")}>
                      {sectionsExpanded.strategies ? "Hide" : "Show"}
                    </Button>
                  </Stack>
                  <Collapse in={sectionsExpanded.strategies} timeout="auto" unmountOnExit>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                      {STRATEGIES.map((cfg, idx) => (
                        <Grid item xs={12} sm={6} key={cfg.key}>
                          <StrategyCard cfg={cfg} rows={result.payoff} index={idx} />
                        </Grid>
                      ))}
                    </Grid>
                  </Collapse>
                </Paper>

                <NarrativeCard text={result.summary_text} />

                <Paper sx={{ p: 3 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6">Charts & Downloads</Typography>
                    <Button size="small" onClick={() => toggleSection("charts")}>
                      {sectionsExpanded.charts ? "Hide" : "Show"}
                    </Button>
                  </Stack>
                  <Collapse in={sectionsExpanded.charts} timeout="auto" unmountOnExit>
                    <Grid container spacing={3} sx={{ mt: 1 }}>
                      <Grid item xs={12} md={6}>
                        <Paper sx={{ p: 3, height: "100%" }}>
                          <Typography variant="subtitle1" gutterBottom>
                            Volatility Impact
                          </Typography>
                          <Box sx={{ height: 300 }}>
                            <VegaChart rows={result.vega_curve} />
                          </Box>
                        </Paper>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Paper sx={{ p: 3, height: "100%" }}>
                          <Typography variant="subtitle1" gutterBottom>
                            Recent Price Action
                          </Typography>
                          <Box sx={{ height: 220 }}>
                            <HistoryChart history={result.history} mode={themeMode} />
                          </Box>
                        </Paper>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Paper sx={{ p: 3, height: "100%" }}>
                          <Typography variant="subtitle1" gutterBottom>
                            Downloads
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Export the Excel workbook and high-resolution payoff charts generated by the backend.
                          </Typography>
                          <Downloads files={result.files} />
                        </Paper>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <ExportCenter result={result} />
                      </Grid>
                    </Grid>
                  </Collapse>
                </Paper>

                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Greeks & Key Metrics
                  </Typography>
                  <SummaryTable rows={result.summary} />
                </Paper>

                <ComparisonBoard base={result} comparisons={comparisons} onRemove={removeComparison} />
                <Paper sx={{ p: 3 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6">News</Typography>
                    <Button size="small" onClick={() => toggleSection("news")}>
                      {sectionsExpanded.news ? "Hide" : "Show"}
                    </Button>
                  </Stack>
                  <Collapse in={sectionsExpanded.news} timeout="auto" unmountOnExit>
                    {news.loading ? (
                      <LinearProgress sx={{ mt: 2 }} />
                    ) : (
                      <NewsPanel articles={news.articles} warning={news.warning} />
                    )}
                  </Collapse>
                </Paper>
              </Stack>
            </Fade>
          </Grid>
        )}
        </Grid>
      </Container>
    </ThemeProvider>
  );
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<OptionsDashboard />);
