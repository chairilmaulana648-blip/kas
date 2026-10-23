const SPREADSHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ3wjaCRLQKJilPP9gEDeXlRUIxLXt4h9376paAQz2JNFDedGbYyWdOvEIVlZHNBbsNpLzSydaM4EIz/pub?output=csv";

function parseCsv(csvText) {
  const rows = [];
  let row = [];
  let value = "";
  let insideQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const character = csvText[index];

    if (character === '"') {
      if (insideQuotes && csvText[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (character === "," && !insideQuotes) {
      row.push(value.trim());
      value = "";
    } else if ((character === "\n" || character === "\r") && !insideQuotes) {
      if (character === "\r" && csvText[index + 1] === "\n") {
        index += 1;
      }
      row.push(value.trim());
      if (row.some((cell) => cell !== "")) {
        rows.push(row);
      }
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value.trim());
    if (row.some((cell) => cell !== "")) {
      rows.push(row);
    }
  }

  return rows;
}

function parseNominal(value) {
  const normalized = value.replace(/[^\d-]/g, "");
  const nominal = Number(normalized);

  if (!Number.isFinite(nominal)) {
    throw new Error(`Nominal tidak valid: "${value}".`);
  }

  return nominal;
}

function formatRupiah(nominal) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(nominal);
}

function hitungRingkasan(csvText) {
  const rows = parseCsv(csvText.replace(/^\uFEFF/, ""));
  const headers = rows.shift()?.map((header) => header.toLowerCase());
  const jenisIndex = headers?.indexOf("jenis") ?? -1;
  const nominalIndex = headers?.indexOf("nominal") ?? -1;

  if (jenisIndex < 0 || nominalIndex < 0) {
    throw new Error('Kolom "jenis" dan "nominal" tidak ditemukan di CSV.');
  }

  return rows.reduce(
    (totals, row) => {
      const jenis = row[jenisIndex]?.toLowerCase();
      if (jenis !== "pemasukan" && jenis !== "pengeluaran") {
        return totals;
      }

      const nominalValue = row[nominalIndex];
      if (!nominalValue) {
        throw new Error(`Nominal ${jenis} kosong.`);
      }

      totals[jenis] += parseNominal(nominalValue);
      return totals;
    },
    { pemasukan: 0, pengeluaran: 0 },
  );
}

async function muatDashboardKeuangan() {
  const elPemasukan = document.getElementById("total-pemasukan");
  const elPengeluaran = document.getElementById("total-pengeluaran");
  const elSaldo = document.getElementById("saldo");

  if (!elPemasukan || !elPengeluaran || !elSaldo) {
    return;
  }

  [elPemasukan, elPengeluaran, elSaldo].forEach((element) => {
    element.textContent = "Memuat...";
  });

  try {
    const response = await fetch(SPREADSHEET_CSV_URL);
    if (!response.ok) {
      throw new Error(`Permintaan gagal dengan status ${response.status}.`);
    }

    const totals = hitungRingkasan(await response.text());
    elPemasukan.textContent = formatRupiah(totals.pemasukan);
    elPengeluaran.textContent = formatRupiah(totals.pengeluaran);
    elSaldo.textContent = formatRupiah(
      totals.pemasukan - totals.pengeluaran,
    );
  } catch (error) {
    console.error("Gagal memuat ringkasan kas dari Google Sheets:", error);
    [elPemasukan, elPengeluaran, elSaldo].forEach((element) => {
      element.textContent = "Gagal memuat";
    });
  }
}

muatDashboardKeuangan();
