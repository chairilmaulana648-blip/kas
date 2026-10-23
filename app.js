const spreadsheetCsvUrls = {
  rekap:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vT2tWaJ8CNvOCD6CqeyP07YV7MyVyD-QhDtw_cmkrzEBSSlvABZZQtSSPBdJtsoVjYmZmK11K7Lw1fJ/pub?gid=311741769&single=true&output=csv",
  nunggak: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTlHVY8JOnCbzF_t_JUP8WNqW0ReyWB942H8wZoDgabSkpYmnMcqE4ZBvJnT1DsTfoQHPFGIh_CI1ON/pub?output=csv",
};

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
      row.push(value);
      value = "";
    } else if ((character === "\n" || character === "\r") && !insideQuotes) {
      if (character === "\r" && csvText[index + 1] === "\n") {
        index += 1;
      }
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  return rows
    .map((cells) => cells.map((cell) => cell.trim()))
    .filter((cells) => cells.some((cell) => cell !== ""));
}

function showMessage(tableBody, columnCount, message) {
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.colSpan = columnCount;
  cell.textContent = message;
  row.append(cell);
  tableBody.replaceChildren(row);
}

async function loadTable({ url, bodyId, columnCount }) {
  const tableBody = document.getElementById(bodyId);
  if (!tableBody) {
    return;
  }

  if (
    !url.startsWith(
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vT2tWaJ8CNvOCD6CqeyP07YV7MyVyD-QhDtw_cmkrzEBSSlvABZZQtSSPBdJtsoVjYmZmK11K7Lw1fJ/pub?gid=311741769&single=true&output=csv",
    )
  ) {
    showMessage(tableBody, columnCount, "URL CSV Google Sheets belum diatur.");
    return;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Permintaan gagal dengan status ${response.status}.`);
    }

    const csvText = (await response.text()).replace(/^\uFEFF/, "");
    const rows = parseCsv(csvText).slice(1);

    if (rows.length === 0) {
      showMessage(tableBody, columnCount, "Belum ada data di spreadsheet.");
      return;
    }

    const fragment = document.createDocumentFragment();
    rows.forEach((cells) => {
      const row = document.createElement("tr");

      for (let index = 0; index < columnCount; index += 1) {
        const cell = document.createElement("td");
        cell.textContent = cells[index] ?? "";
        row.append(cell);
      }

      fragment.append(row);
    });

    tableBody.replaceChildren(fragment);
  } catch (error) {
    console.error(`Gagal memuat data untuk ${bodyId}:`, error);
    showMessage(
      tableBody,
      columnCount,
      "Data gagal dimuat. Periksa URL CSV dan akses publik spreadsheet.",
    );
  }
}

loadTable({
  url: spreadsheetCsvUrls.rekap,
  bodyId: "rekap-table-body",
  columnCount: 5,
});

loadTable({
  url: spreadsheetCsvUrls.nunggak,
  bodyId: "nunggak-table-body",
  columnCount: 2,
});
