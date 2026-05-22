import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { Html5Qrcode } from "html5-qrcode";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Home() {
  const [tanggal, setTanggal] = useState(
    new Date().toISOString().split("T")[0]
  );

  const [jam, setJam] = useState(formatTime(new Date()));

  const [sku, setSku] = useState("");
  const [ringkasan, setRingkasan] = useState("");

  const [plant, setPlant] = useState("1111");
  const [plantManual, setPlantManual] = useState("");

  const [noPalet, setNoPalet] = useState("");
  const [beratPerKemasan, setBeratPerKemasan] = useState("");
  const [qtyKemasan, setQtyKemasan] = useState("");
  const [qtyKg, setQtyKg] = useState("");

  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setJam(formatTime(new Date()));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  function formatTime(date) {
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    const ss = String(date.getSeconds()).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }

  async function lookupSKU(value) {
    if (!value) return;

    const { data } = await supabase
      .from("master_rm")
      .select("ringkasan_rm")
      .eq("sku_qr", value)
      .single();

    if (data) {
      setRingkasan(data.ringkasan_rm);
    } else {
      setRingkasan("SKU tidak ditemukan");
    }
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

    if (parts.length === 2) {
      return `${parts[0]} - ${parts[1]}`;
    }

    return value;
  }

  async function handleSubmit() {
    setErrorMsg("");

    if (!sku || !qtyKemasan || !qtyKg) {
      setErrorMsg("Field wajib belum lengkap");
      return;
    }

    if (!Number.isInteger(Number(qtyKemasan))) {
      setErrorMsg("Qty Kemasan harus bilangan bulat");
      return;
    }

    if (isNaN(Number(qtyKg.replace(",", ".")))) {
      setErrorMsg("Qty KG harus angka");
      return;
    }

    if (
      beratPerKemasan &&
      isNaN(Number(beratPerKemasan.replace(",", ".")))
    ) {
      setErrorMsg("Berat per Kemasan harus angka");
      return;
    }

    const finalPlant =
      plant === "LAINNYA" ? plantManual : plant;

    const finalPalet = formatNoPalet(noPalet);

    setLoading(true);

    const { error } = await supabase
      .from("trx_rm")
      .insert([
        {
          input_tanggal: tanggal,
          input_jam: jam,
          sku_qr: sku,
          ringkasan_rm: ringkasan,
          plant_tujuan: finalPlant,
          no_palet: finalPalet,
          berat_per_kemasan:
            beratPerKemasan === ""
              ? null
              : parseFloat(
                  beratPerKemasan.replace(",", ".")
                ),
          qty_kemasan: parseInt(qtyKemasan),
          qty_kg: parseFloat(qtyKg.replace(",", "."))
        }
      ]);

    setLoading(false);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    new Audio(
      "https://actions.google.com/sounds/v1/cartoon/clang_and_wobble.ogg"
    ).play();

    setSuccess(true);

    setSku("");
    setRingkasan("");
    setPlant("1111");
    setPlantManual("");
    setNoPalet("");
    setBeratPerKemasan("");
    setQtyKemasan("");
    setQtyKg("");

    setTimeout(() => setSuccess(false), 3000);
  }

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

        <button
          className="btn-scan"
          onClick={startScanner}
        >
          SCAN QR KAMERA
        </button>

        {scannerOpen && <div id="reader"></div>}

        <label>Ringkasan RM</label>
        <div className="rm-box">{ringkasan}</div>

        <label>Plant Tujuan</label>
        <select
          value={plant}
          onChange={(e) => setPlant(e.target.value)}
        >
          <option>1111</option>
          <option>1112</option>
          <option>1113</option>
          <option>LAINNYA</option>
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
          onChange={(e) =>
            setBeratPerKemasan(e.target.value)
          }
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

        <button
          className="btn-submit"
          onClick={handleSubmit}
        >
          {loading ? "MENYIMPAN..." : "SUBMIT"}
        </button>
      </div>
    </div>
  );
}
