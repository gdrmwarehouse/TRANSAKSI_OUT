import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Home() {
  const today = new Date();

  const [tanggal, setTanggal] = useState(
    today.toISOString().split("T")[0]
  );

  const [jam, setJam] = useState(
    today.toLocaleTimeString("id-ID")
  );

  const [sku, setSku] = useState("");
  const [ringkasan, setRingkasan] = useState("");

  const [plant, setPlant] = useState("1111");
  const [plantManual, setPlantManual] = useState("");

  const [noPalet, setNoPalet] = useState("");
  const [beratPerKemasan, setBeratPerKemasan] = useState("");
  const [qtyKemasan, setQtyKemasan] = useState("");
  const [qtyKg, setQtyKg] = useState("");

  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setJam(new Date().toLocaleTimeString("id-ID"));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

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

  function formatNoPalet(value) {
    const parts = value.trim().split(/\s+/);
    if (parts.length === 2) {
      return `${parts[0]} - ${parts[1]}`;
    }
    return value;
  }

  async function handleSubmit() {
    if (!sku || !qtyKemasan || !qtyKg) {
      alert("Field wajib belum lengkap");
      return;
    }

    const finalPlant =
      plant === "LAINNYA" ? plantManual : plant;

    const finalPalet = formatNoPalet(noPalet);

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

    if (error) {
      alert(error.message);
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
      {success && (
        <div className="success">BERHASIL</div>
      )}

      <h2>INPUT TRANSAKSI RM OUT</h2>

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
      />

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
      />

      <label>Berat per Kemasan (optional)</label>
      <input
        value={beratPerKemasan}
        onChange={(e) =>
          setBeratPerKemasan(e.target.value)
        }
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
      />

      <button onClick={handleSubmit}>
        SUBMIT
      </button>
    </div>
  );
}
