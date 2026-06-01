import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { Html5Qrcode } from "html5-qrcode";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const CORRECT_PIN = "225588"; // ← GANTI PIN DI SINI

export default function Home() {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [shakePing, setShakePin] = useState(false);

  const [tanggal, setTanggal] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [jam, setJam] = useState(formatTime(new Date()));
  const [sku, setSku] = useState("");
  const [ringkasan, setRingkasan] = useState("");
  const [plant, setPlant] = useState("");
  const [plantManual, setPlantManual] = useState("");
  const [noPalet, setNoPalet] = useState("");
  const [beratPerKemasan, setBeratPerKemasan] = useState("");
  const [qtyKemasan, setQtyKemasan] = useState("");
  const [qtyKg, setQtyKg] = useState("");
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
const [historyDate, setHistoryDate] = useState(
  new Date().toISOString().split("T")[0]
);
const [historyPlant, setHistoryPlant] = useState("");
const [historyRows, setHistoryRows] = useState([]);
const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem("unlocked");
    if (saved === "yes") setUnlocked(true);

    const interval = setInterval(() => {
      setJam(formatTime(new Date()));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
  if (showHistory) {
    loadHistory();
  }
}, [showHistory, historyDate, historyPlant]);
  
  function formatTime(date) {
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    const ss = String(date.getSeconds()).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }

  // ── Hitung Netto Otomatis ──
  const qtyKgNum       = parseFloat(String(qtyKg).replace(",", ".")) || 0;
  const qtyKemasanNum  = parseInt(qtyKemasan) || 0;
  const beratKemasanNum= parseFloat(String(beratPerKemasan).replace(",", ".")) || 0;
  const netto = beratPerKemasan !== ""
    ? qtyKgNum - (qtyKemasanNum * beratKemasanNum)
    : null;

  // ── PIN HANDLER ──
  function handlePinPress(digit) {
    if (pin.length >= 6) return;
    const newPin = pin + digit;
    setPin(newPin);
    if (newPin.length === 6) {
      if (newPin === CORRECT_PIN) {
        sessionStorage.setItem("unlocked", "yes");
        setUnlocked(true);
        setPinError("");
      } else {
        setShakePin(true);
        setPinError("PIN salah, coba lagi");
        setTimeout(() => {
          setPin("");
          setPinError("");
          setShakePin(false);
        }, 800);
      }
    }
  }

  function handlePinDelete() {
    setPin(pin.slice(0, -1));
    setPinError("");
  }

  // ── FORM HANDLER ──
  async function lookupSKU(value) {
    if (!value) return;
    const { data } = await supabase
      .from("master_rm")
      .select("ringkasan_rm")
      .eq("sku_qr", value)
      .single();
    setRingkasan(data ? data.ringkasan_rm : "SKU tidak ditemukan");
  }

  async function startScanner() {
    setScannerOpen(true);
    const qr = new Html5Qrcode("reader");
    try {
      await qr.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        async (decodedText) => {
          setSku(decodedText);
          await lookupSKU(decodedText);
          await qr.stop();
          setScannerOpen(false);
        }
      );
    } catch (err) {
      setErrorMsg("Kamera gagal dibuka");
      setScannerOpen(false);
    }
  }

  function formatNoPalet(value) {
    const parts = value.trim().split(/\s+/);
    return parts.length === 2 ? `${parts[0]} - ${parts[1]}` : value;
  }

  async function loadHistory() {
  setHistoryLoading(true);
  setErrorMsg("");

  let query = supabase
    .from("trx_rm")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (historyDate) {
    query = query.eq("input_tanggal", historyDate);
  }

  if (historyPlant) {
    query = query.eq("plant_tujuan", historyPlant);
  }

  const { data, error } = await query;

  setHistoryLoading(false);

  if (error) {
    setErrorMsg(error.message);
    return;
  }

  setHistoryRows(data || []);
}
  
  async function handleSubmit() {
    setErrorMsg("");
    if (!sku || !plant || !qtyKemasan || !qtyKg) {
  setErrorMsg("Field wajib belum lengkap");
  return;
}
    if (!Number.isInteger(Number(qtyKemasan))) {
      setErrorMsg("Qty Kemasan harus bilangan bulat");
      return;
    }
    if (isNaN(Number(String(qtyKg).replace(",", ".")))) {
      setErrorMsg("Qty KG harus angka");
      return;
    }
    if (beratPerKemasan && isNaN(Number(String(beratPerKemasan).replace(",", ".")))) {
      setErrorMsg("Berat per Kemasan harus angka");
      return;
    }

    if (plant === "LAINNYA" && !plantManual.trim()) {
  setErrorMsg("Plant manual wajib diisi");
  return;
}
    
    const finalPlant = plant === "LAINNYA" ? plantManual : plant;
    const finalPalet = formatNoPalet(noPalet);

    setLoading(true);
    const { error } = await supabase.from("trx_rm").insert([{
      input_tanggal:     tanggal,
      input_jam:         jam,
      sku_qr:            sku,
      ringkasan_rm:      ringkasan,
      plant_tujuan:      finalPlant,
      no_palet:          finalPalet,
      berat_per_kemasan: beratPerKemasan === "" ? null : parseFloat(String(beratPerKemasan).replace(",", ".")),
      qty_kemasan:       parseInt(qtyKemasan),
      qty_kg: parseFloat(String(qtyKg).replace(",", ".")),
      netto_kg: netto,
      sync_status: "pending"
    }]);
    setLoading(false);

    if (error) { setErrorMsg(error.message); return; }

    new Audio("https://actions.google.com/sounds/v1/cartoon/clang_and_wobble.ogg").play();
    setSuccess(true);
    setSku(""); setRingkasan(""); setPlant("");
    setPlantManual(""); setNoPalet(""); setBeratPerKemasan("");
    setQtyKemasan(""); setQtyKg("");
    setTimeout(() => setSuccess(false), 3000);
  }

  // ══════════════════════════════
  // TAMPILAN PIN
  // ══════════════════════════════
  if (!unlocked) {
    const digits = [1,2,3,4,5,6,7,8,9,"",0,"⌫"];
    return (
      <div style={styles.pinWrap}>
        <div style={styles.pinCard}>
          <div style={styles.pinTitle}>MASUKKAN PIN</div>
          <div style={styles.pinSubtitle}>INPUT TRANSAKSI RM OUT</div>

          <div style={styles.dotRow}>
            {[0,1,2,3,4,5].map(i => (
              <div key={i} style={{
                ...styles.dot,
                background: i < pin.length ? "#2563eb" : "#e2e8f0"
              }}/>
            ))}
          </div>

          {pinError && <div style={styles.pinError}>{pinError}</div>}

          <div style={{
            ...styles.keypad,
            animation: shakePing ? "shake 0.4s" : "none"
          }}>
            {digits.map((d, i) => (
              <button
                key={i}
                style={{
                  ...styles.key,
                  ...(d === "" ? styles.keyEmpty : {}),
                  ...(d === "⌫" ? styles.keyDel : {})
                }}
                onClick={() => {
                  if (d === "") return;
                  if (d === "⌫") handlePinDelete();
                  else handlePinPress(String(d));
                }}
                disabled={d === ""}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        <style>{`
          @keyframes shake {
            0%,100% { transform: translateX(0); }
            20% { transform: translateX(-10px); }
            40% { transform: translateX(10px); }
            60% { transform: translateX(-10px); }
            80% { transform: translateX(10px); }
          }
        `}</style>
      </div>
    );
  }

const historySummary = {
  totalTransaksi: historyRows.length,
  totalQtyKemasan: historyRows.reduce(
    (sum, r) => sum + (Number(r.qty_kemasan) || 0),
    0
  ),
  totalQtyKg: historyRows.reduce(
    (sum, r) => sum + (Number(r.qty_kg) || 0),
    0
  ),
  totalNettoKg: historyRows.reduce(
    (sum, r) => sum + (Number(r.netto_kg ?? r.qty_kg) || 0),
    0
  )
};
  // ══════════════════════════════
  // TAMPILAN FORM
  // ══════════════════════════════


  return (
    <div className="container">
      <div className={`card ${loading ? "loading" : ""}`}>
        {success && <div className="success">BERHASIL</div>}
        {errorMsg && <div className="error">{errorMsg}</div>}

        <div className="title">INPUT TRANSAKSI RM OUT</div>

        <label>Tanggal</label>
        <input
          type="date"
          value={tanggal}
          onChange={(e) => setTanggal(e.target.value)}
        />

        <label>Jam</label>
        <input type="text" value={jam} readOnly />

        <label>SKU QR</label>
        <input
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          onBlur={(e) => lookupSKU(e.target.value)}
          placeholder="Scan atau input manual"
        />

        <button className="btn-scan" onClick={startScanner}>
          SCAN QR KAMERA
        </button>
        {scannerOpen && <div id="reader"></div>}

        <label>Ringkasan RM</label>
        <div className="rm-box">{ringkasan}</div>

        <select value={plant} onChange={(e) => setPlant(e.target.value)}>
        <option value="">Pilih Plant Tujuan</option>
         <option value="1111">1111</option>
          <option value="1112">1112</option>
          <option value="1113">1113</option>
          <option value="LAINNYA">LAINNYA</option>
          </select>

        {plant === "LAINNYA" && (
          <input
            placeholder="Input Plant"
            value={plantManual}
            onChange={(e) => setPlantManual(e.target.value)}
          />
        )}

        <label>No Palet</label>
        <input
          value={noPalet}
          onChange={(e) => setNoPalet(e.target.value)}
          placeholder="Contoh: K 102"
        />

        <label>Berat per Kemasan (optional)</label>
        <input
          value={beratPerKemasan}
          onChange={(e) => setBeratPerKemasan(e.target.value)}
          placeholder="Boleh koma"
        />

        <label>Qty Kemasan</label>
        <input
          type="number"
          value={qtyKemasan}
          onChange={(e) => setQtyKemasan(e.target.value)}
        />

        <label>Qty KG</label>
        <input
          value={qtyKg}
          onChange={(e) => setQtyKg(e.target.value)}
          placeholder="Boleh koma"
        />

        {/* ── NETTO OTOMATIS ── */}
        <label>Netto (Otomatis)</label>
        <div style={{
          background: netto === null
            ? "#fefce8"
            : netto < 0
              ? "#fef2f2"
              : "#f0fdf4",
          border: `1.5px solid ${
            netto === null ? "#fde68a" : netto < 0 ? "#fca5a5" : "#86efac"
          }`,
          borderRadius: 10,
          padding: "12px 16px",
          fontSize: 15,
          fontWeight: 600,
          color: netto === null
            ? "#92400e"
            : netto < 0
              ? "#dc2626"
              : "#15803d",
          marginBottom: 8,
          minHeight: 44,
          display: "flex",
          alignItems: "center"
        }}>
          {netto === null
            ? "⚖️ Tanpa berat kemasan (berat standar)"
            : netto < 0
              ? "⚠️ Netto negatif, cek kembali input"
              : `✅ Netto: ${netto.toLocaleString("id-ID", { maximumFractionDigits: 3 })} Kg`
          }
        </div>

        <button className="btn-submit" onClick={handleSubmit}>
          {loading ? "MENYIMPAN..." : "SUBMIT"}
        </button>
          <button
  className="btn-history"
  type="button"
  onClick={() => setShowHistory(!showHistory)}
>
  {showHistory ? "TUTUP HISTORY / SUMMARY" : "LIHAT HISTORY / SUMMARY"}
</button>

{showHistory && (
  <div className="history-panel">
    <div className="history-title">HISTORY & SUMMARY</div>

    <label>Filter Tanggal</label>
    <input
      type="date"
      value={historyDate}
      onChange={(e) => setHistoryDate(e.target.value)}
    />

    <label>Filter Plant</label>
    <select
      value={historyPlant}
      onChange={(e) => setHistoryPlant(e.target.value)}
    >
      <option value="">Semua Plant</option>
      <option value="1111">1111</option>
      <option value="1112">1112</option>
      <option value="1113">1113</option>
      <option value="LAINNYA">LAINNYA</option>
    </select>

    <button
      className="btn-refresh"
      type="button"
      onClick={loadHistory}
    >
      REFRESH HISTORY
    </button>

    <div className="summary-grid">
      <div className="summary-card">
        <span>Total Transaksi</span>
        <b>{historySummary.totalTransaksi}</b>
      </div>

      <div className="summary-card">
        <span>Total Kemasan</span>
        <b>{historySummary.totalQtyKemasan}</b>
      </div>

      <div className="summary-card">
        <span>Total Qty KG</span>
        <b>
          {historySummary.totalQtyKg.toLocaleString("id-ID", {
            maximumFractionDigits: 3
          })}
        </b>
      </div>

      <div className="summary-card">
        <span>Total Netto</span>
        <b>
          {historySummary.totalNettoKg.toLocaleString("id-ID", {
            maximumFractionDigits: 3
          })}
        </b>
      </div>
    </div>

    {historyLoading && (
      <div className="history-loading">Memuat history...</div>
    )}

    {!historyLoading && historyRows.length === 0 && (
      <div className="history-empty">Belum ada data untuk filter ini.</div>
    )}

    {!historyLoading &&
      historyRows.map((row) => (
        <div className="history-card" key={row.id}>
          <div className="history-main">
            <b>{row.input_jam || "-"}</b>
            <span>{row.plant_tujuan || "-"}</span>
          </div>

          <div className="history-sku">
            {row.sku_qr || "-"}
          </div>

          <div className="history-rm">
            {row.ringkasan_rm || "-"}
          </div>

          <div className="history-detail">
            <span>Palet: {row.no_palet || "-"}</span>
            <span>
              Qty: {row.qty_kemasan || 0} / {row.qty_kg || 0} KG
            </span>
          </div>

          <div className="history-netto">
            Netto:{" "}
            {(Number(row.netto_kg ?? row.qty_kg) || 0).toLocaleString(
              "id-ID",
              { maximumFractionDigits: 3 }
            )}{" "}
            KG
          </div>
        </div>
      ))}
  </div>
)}
      </div>
    </div>
  );
}

const styles = {
  pinWrap: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f1f5f9"
  },
  pinCard: {
    background: "#fff",
    borderRadius: 20,
    padding: "40px 32px",
    boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    width: 320
  },
  pinTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: "#1e293b",
    letterSpacing: 2,
    marginBottom: 4
  },
  pinSubtitle: {
    fontSize: 11,
    color: "#94a3b8",
    marginBottom: 32,
    letterSpacing: 1
  },
  dotRow: {
    display: "flex",
    gap: 14,
    marginBottom: 16
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: "50%",
    transition: "background 0.2s"
  },
  pinError: {
    color: "#ef4444",
    fontSize: 13,
    marginBottom: 8
  },
  keypad: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 72px)",
    gap: 12,
    marginTop: 16
  },
  key: {
    height: 72,
    borderRadius: 14,
    border: "none",
    background: "#f1f5f9",
    fontSize: 24,
    fontWeight: 600,
    color: "#1e293b",
    cursor: "pointer",
    transition: "background 0.15s"
  },
  keyEmpty: {
    background: "transparent",
    cursor: "default"
  },
  keyDel: {
    background: "#fee2e2",
    color: "#ef4444"
  }
};
