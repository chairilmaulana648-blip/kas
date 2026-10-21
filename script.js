/**
 * Configuration: Paste your Google Sheets Published CSV URL here
 * Ensure your Google Sheet is published to web as CSV:
 * File -> Share -> Publish to web -> Link format: CSV
 */
const GOOGLE_SHEETS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT2tWaJ8CNvOCD6CqeyP07YV7MyVyD-QhDtw_cmkrzEBSSlvABZZQtSSPBdJtsoVjYmZmK11K7Lw1fJ/pub?gid=123456789&single=true&output=csv";

// Data Storage
let rawTransactions = [];
let activeFilterTab = 'all';
let chartInstance = null;

// DOM Elements
const txTableBody = document.getElementById('tx-table-body');
const txLoading = document.getElementById('tx-loading');
const txEmpty = document.getElementById('tx-empty');
const txSearch = document.getElementById('tx-search');
const syncStatus = document.getElementById('sync-status');
const lastUpdateTime = document.getElementById('last-update-time');

// Fetch and Parse CSV Data from Google Sheets
function fetchSheetData() {
    // Show UI loading indicators
    const syncIcon = document.getElementById('sync-icon');
    const syncIconMobile = document.getElementById('sync-icon-mobile');
    if (syncIcon) syncIcon.classList.add('spin-active');
    if (syncIconMobile) syncIconMobile.classList.add('spin-active');
    
    if (txLoading) txLoading.classList.remove('hidden');
    if (txEmpty) txEmpty.classList.add('hidden');
    if (syncStatus) syncStatus.innerText = "Syncing with Sheets...";

    Papa.parse(GOOGLE_SHEETS_CSV_URL, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            // Remove animation spin
            if (syncIcon) syncIcon.classList.remove('spin-active');
            if (syncIconMobile) syncIconMobile.classList.remove('spin-active');

            if (results.data && results.data.length > 0) {
                processParsedData(results.data);
            } else {
                useFallbackDemoData();
            }
        },
        error: function(err) {
            console.warn("Unable to fetch Google Sheets CSV, using local fallback data.", err);
            if (syncIcon) syncIcon.classList.remove('spin-active');
            if (syncIconMobile) syncIconMobile.classList.remove('spin-active');
            useFallbackDemoData();
        }
    });
}

// Fallback data when Google Sheets URL is unconfigured or unavailable
function useFallbackDemoData() {
    const demoData = [
        { Tanggal: '20 Okt 2026', Keterangan: 'Kas Mingguan Minggu 3 (32 Siswa)', Kategori: 'Masuk', Jumlah: '160000' },
        { Tanggal: '15 Okt 2026', Keterangan: 'Beli Kertas HVS & Map Kelas', Kategori: 'Keluar', Jumlah: '35000' },
        { Tanggal: '12 Okt 2026', Keterangan: 'Kas Mingguan Minggu 2 (30 Siswa)', Kategori: 'Masuk', Jumlah: '150000' },
        { Tanggal: '10 Okt 2026', Keterangan: 'Spidol Whiteboard & Penghapus', Kategori: 'Keluar', Jumlah: '45000' },
        { Tanggal: '05 Okt 2026', Keterangan: 'Kas Mingguan Minggu 1 (34 Siswa)', Kategori: 'Masuk', Jumlah: '170000' },
        { Tanggal: '01 Okt 2026', Keterangan: 'Sapu & Equipment Kebersihan', Kategori: 'Keluar', Jumlah: '45000' }
    ];
    processParsedData(demoData, true);
}

// Normalize & Process Row Items
function processParsedData(rows, isFallback = false) {
    rawTransactions = [];

    rows.forEach((row, index) => {
        // Read columns regardless of case
        const date = row['Tanggal'] || row['tanggal'] || row['Date'] || row['Bulan'] || '-';
        const desc = row['Keterangan'] || row['keterangan'] || row['Deskripsi'] || row['Nama'] || 'Transaksi Kas';
        const categoryRaw = (row['Kategori'] || row['kategori'] || row['Tipe'] || row['Type'] || 'Masuk').toString().toLowerCase();
        const amountRaw = row['Jumlah'] || row['jumlah'] || row['Nominal'] || row['Kredit'] || '0';

        // Format clean integer from number strings
        const cleanAmount = parseInt(amountRaw.toString().replace(/[^0-9]/g, '')) || 0;
        const isMasuk = !categoryRaw.includes('keluar');

        if (cleanAmount > 0 || desc !== 'Transaksi Kas') {
            rawTransactions.push({
                id: index + 1,
                date: date,
                desc: desc,
                type: isMasuk ? 'masuk' : 'keluar',
                amount: cleanAmount
            });
        }
    });

    updateSummaryMetrics();
    renderTransactionsTable();
    updateChart();

    if (txLoading) txLoading.classList.add('hidden');
    if (syncStatus) {
        syncStatus.innerText = isFallback ? "Demo Data Mode" : "Live Google Sheets Sync";
    }

    const now = new Date();
    if (lastUpdateTime) {
        lastUpdateTime.innerText = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
    }
}

// Calculate Summary Cards Balance
function updateSummaryMetrics() {
    let totalMasuk = 0;
    let countMasuk = 0;
    let totalKeluar = 0;
    let countKeluar = 0;

    rawTransactions.forEach(tx => {
        if (tx.type === 'masuk') {
            totalMasuk += tx.amount;
            countMasuk++;
        } else {
            totalKeluar += tx.amount;
            countKeluar++;
        }
    });

    const saldoBersih = totalMasuk - totalKeluar;

    // Update Hero UI
    document.getElementById('hero-saldo-saat-ini').innerText = formatRupiah(saldoBersih);
    document.getElementById('hero-total-masuk').innerText = formatRupiah(totalMasuk);
    document.getElementById('hero-total-keluar').innerText = formatRupiah(totalKeluar);

    // Update Cards UI
    document.getElementById('card-masuk').innerText = formatRupiah(totalMasuk);
    document.getElementById('card-masuk-count').innerText = `${countMasuk} Transaksi Kas Masuk`;
    document.getElementById('card-keluar').innerText = formatRupiah(totalKeluar);
    document.getElementById('card-keluar-count').innerText = `${countKeluar} Transaksi Pengeluaran`;
    document.getElementById('card-sisa').innerText = formatRupiah(saldoBersih);
}

// Render Filtered Table Items
function renderTransactionsTable() {
    const query = txSearch.value.toLowerCase();
    
    const filtered = rawTransactions.filter(tx => {
        const matchesType = activeFilterTab === 'all' || tx.type === activeFilterTab;
        const matchesQuery = tx.desc.toLowerCase().includes(query) || tx.date.toLowerCase().includes(query);
        return matchesType && matchesQuery;
    });

    txTableBody.innerHTML = '';

    if (filtered.length === 0) {
        txEmpty.classList.remove('hidden');
    } else {
        txEmpty.classList.add('hidden');
        filtered.forEach(tx => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-slate-50/80 transition-all";

            const isMasuk = tx.type === 'masuk';
            const badge = isMasuk 
                ? '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800"><i class="fa-solid fa-arrow-down mr-1"></i> Masuk</span>'
                : '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800"><i class="fa-solid fa-arrow-up mr-1"></i> Keluar</span>';
            
            const amountClass = isMasuk ? 'text-emerald-600 font-bold' : 'text-slate-800 font-bold';
            const formattedAmount = (isMasuk ? '+ ' : '- ') + formatRupiah(tx.amount);

            tr.innerHTML = `
                <td class="py-3.5 px-4 sm:px-6 text-xs text-slate-500 font-medium">${tx.date}</td>
                <td class="py-3.5 px-4 sm:px-6 font-semibold text-slate-900">${tx.desc}</td>
                <td class="py-3.5 px-4 sm:px-6">${badge}</td>
                <td class="py-3.5 px-4 sm:px-6 text-right ${amountClass}">${formattedAmount}</td>
            `;
            txTableBody.appendChild(tr);
        });
    }
}

// Filter Tabs Control
function filterTransactions(tab) {
    activeFilterTab = tab;
    document.querySelectorAll('.tx-tab').forEach(btn => {
        btn.className = "tx-tab px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 transition-all";
    });
    const activeBtn = document.getElementById(`btn-tab-${tab}`);
    if (activeBtn) {
        activeBtn.className = "tx-tab px-3 py-1.5 rounded-lg bg-white shadow-sm text-slate-800 font-bold transition-all";
    }
    renderTransactionsTable();
}

// Update / Render Dynamic Chart
function updateChart() {
    const ctx = document.getElementById('cashChart').getContext('2d');

    const labels = rawTransactions.slice(-7).map(tx => tx.date);
    const dataMasuk = rawTransactions.slice(-7).map(tx => tx.type === 'masuk' ? tx.amount : 0);
    const dataKeluar = rawTransactions.slice(-7).map(tx => tx.type === 'keluar' ? tx.amount : 0);

    if (chartInstance) {
        chartInstance.destroy();
    }

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.length > 0 ? labels : ['1', '2', '3'],
            datasets: [
                {
                    label: 'Pemasukan (Rp)',
                    data: dataMasuk,
                    backgroundColor: '#10b981',
                    borderRadius: 6
                },
                {
                    label: 'Pengeluaran (Rp)',
                    data: dataKeluar,
                    backgroundColor: '#f43f5e',
                    borderRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { font: { family: 'Inter', size: 12 } }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#f1f5f9' },
                    ticks: {
                        callback: function(val) { return 'Rp ' + (val / 1000) + 'k'; }
                    }
                },
                x: { grid: { display: false } }
            }
        }
    });
}

// Helpers
function formatRupiah(number) {
    return 'Rp ' + number.toLocaleString('id-ID');
}

// Modal Toggle Functions
function openPayModal() {
    document.getElementById('payModal').classList.remove('hidden');
}
function closePayModal() {
    document.getElementById('payModal').classList.add('hidden');
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    fetchSheetData();

    if (txSearch) {
        txSearch.addEventListener('input', renderTransactionsTable);
    }

    // Mobile Menu
    const menuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    if (menuBtn && mobileMenu) {
        menuBtn.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
        document.querySelectorAll('.mobile-link').forEach(link => {
            link.addEventListener('click', () => mobileMenu.classList.add('hidden'));
        });
    }
});