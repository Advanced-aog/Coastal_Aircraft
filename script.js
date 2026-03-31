
// Chart.js Configuration
const ctx = document.getElementById('revenueChart').getContext('2d');

const historicalData = [3.08, 4.77, 2.74]; // 2023, 2024, 2025 (in Millions)
const baseProjection = [10.45, 14.57, 21.70]; // 2026, 2027, 2028
const upsideProjection = [11.00, 16.00, 24.00]; // Upside

// Financial Data (Millions)
const financials = {
    historical: {
        revenue: [3.08, 4.77, 2.74],
        cogs: [1.68, 3.13, 1.67],
        opex: [1.21, 1.17, 0.98],
        ebitda: [0.19, 0.47, 0.08] // Net Income for historicals as proxy, or use actual EBITDA if known. Using Net Income from doc.
    },
    base: {
        revenue: [10.45, 14.57, 21.70],
        cogs: [4.79, 6.47, 10.11],
        opex: [2.00, 3.00, 4.00],
        ebitda: [3.66, 5.10, 7.59]
    },
    upside: {
        revenue: [11.00, 16.00, 24.00],
        cogs: [5.15, 7.40, 11.60],
        opex: [2.00, 3.00, 4.00],
        ebitda: [3.85, 5.60, 8.40]
    }
};

const labels = ['2023', '2024', '2025', '2026 (Proj)', '2027 (Proj)', '2028 (Proj)'];

// Combined Data for Initial Render (Base Case)
let currentData = [...historicalData, ...baseProjection];

const revenueChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: labels,
        datasets: [{
            label: 'Total Revenue ($MM)',
            data: currentData,
            borderColor: '#00a8e8',
            backgroundColor: 'rgba(0, 168, 232, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: '#00a8e8',
            pointRadius: 5
        }]
    },
    options: {
        responsive: true,
        plugins: {
            legend: {
                labels: { color: '#ccc' }
            },
            tooltip: {
                callbacks: {
                    label: function (context) {
                        return `$${context.parsed.y} Million`;
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: { color: '#333' },
                ticks: { color: '#8b949e', callback: value => '$' + value + 'M' }
            },
            x: {
                grid: { display: false },
                ticks: { color: '#8b949e' }
            }
        }
    }
});

function renderTable(scenario) {
    const tbody = document.getElementById('plBody');
    const projData = financials[scenario];
    const hist = financials.historical;

    // Helper to format numbers
    const fmt = (n) => n.toFixed(2);

    // Calculate Gross Profit & Margin
    const getGP = (rev, cogs) => rev - cogs;

    // Arrays for rows
    const revoc = [...hist.revenue, ...projData.revenue];
    const cogs = [...hist.cogs, ...projData.cogs];
    const opex = [...hist.opex, ...projData.opex];
    const ebitda = [...hist.ebitda, ...projData.ebitda];

    const grossProfit = revoc.map((r, i) => r - cogs[i]);

    // Generate Rows HTML
    const createRow = (label, data, isTotal = false, indent = false) => {
        let cells = data.map(d => `<td>$${fmt(d)}</td>`).join('');
        return `<tr class="${isTotal ? 'total-row' : ''}">
            <td class="${indent ? 'indent' : ''}">${label}</td>
            ${cells}
        </tr>`;
    };

    tbody.innerHTML = `
        ${createRow('Total Revenue', revoc, true)}
        ${createRow('Cost of Goods Sold', cogs, false, true)}
        ${createRow('Gross Profit', grossProfit, true)}
        ${createRow('Operating Expenses', opex, false, true)}
        ${createRow('EBITDA / Net Income', ebitda, true)}
    `;

    document.getElementById('tableTitle').innerText = scenario === 'base'
        ? 'Projected Profit & Loss Statement (Base Case)'
        : 'Projected Profit & Loss Statement (Upside Case)';
}

function updateChart(scenario) {
    if (scenario === 'base') {
        revenueChart.data.datasets[0].data = [...historicalData, ...baseProjection];
        document.getElementById('btn-base').classList.add('active');
        document.getElementById('btn-upside').classList.remove('active');
    } else {
        revenueChart.data.datasets[0].data = [...historicalData, ...upsideProjection];
        document.getElementById('btn-base').classList.remove('active');
        document.getElementById('btn-upside').classList.add('active');
    }
    revenueChart.update();
    renderTable(scenario);
}

// Initial Render
renderTable('base');

// Investment Calculator
const techInput = document.getElementById('techCount');
const rateInput = document.getElementById('billableRate');
const hangarInput = document.getElementById('hangarRevenue');

const techDisplay = document.getElementById('techDisplay');
const rateDisplay = document.getElementById('rateDisplay');
const hangarDisplay = document.getElementById('hangarDisplay');

const outService = document.getElementById('calcServiceRev');
const outTotal = document.getElementById('calcTotalRev');

// Assumptions
const BILLABLE_HOURS_PER_TECH = 1900; // Estimated from 2027 Projections ($6.3M / 20 techs / $165 ~= 1900)
const EST_FUEL_MISC_REVENUE = 1000000; // Fixed $1M estimate (Fuel + Parts markup)

function formatCurrency(num) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
}

function updateCalculator() {
    // Get values
    const techs = parseInt(techInput.value);
    const rate = parseInt(rateInput.value);
    const hangar = parseInt(hangarInput.value);

    // Update displays
    techDisplay.textContent = techs;
    rateDisplay.textContent = '$' + rate;
    hangarDisplay.textContent = formatCurrency(hangar);

    // Calculate
    const serviceRevenue = techs * BILLABLE_HOURS_PER_TECH * rate;
    const totalRevenue = serviceRevenue + hangar + EST_FUEL_MISC_REVENUE;

    // Output
    outService.textContent = formatCurrency(serviceRevenue);
    outTotal.textContent = formatCurrency(totalRevenue);
}

// Initialize
updateCalculator();

// ==========================================
// Revenue Waterfall Interactive Widget
// ==========================================
const waterfallStages = {
    day1: {
        label: 'Day 1 — Immediate Revenue',
        total: 550000,
        segments: [
            { name: 'Hangarage', amount: 550000, color: '#00a8e8', desc: 'Inherited tenant revenue on acquisition' }
        ]
    },
    year1: {
        label: 'Year 1 — Combined Teams',
        total: 10450000,
        segments: [
            { name: 'Hangarage', amount: 650000, color: '#00a8e8', desc: 'Georgia + California Assets' },
            { name: 'MRO Labor', amount: 7000000, color: '#0284c7', desc: '35 techs across ATL & KSBA' },
            { name: 'Fuel Sales', amount: 1800000, color: '#7c3aed', desc: 'Combined ramp utilization' },
            { name: 'Parts & Markup', amount: 1000000, color: '#f59e0b', desc: 'Expanded industry reach' }
        ]
    },
    year3: {
        label: 'Year 3 — National Scale',
        total: 21700000,
        segments: [
            { name: 'Hangarage', amount: 900000, color: '#00a8e8', desc: 'Maximized facility capacity' },
            { name: 'MRO Labor', amount: 15600000, color: '#0284c7', desc: 'Top-tier tech saturation ($180/hr)' },
            { name: 'Fuel Sales', amount: 3000000, color: '#7c3aed', desc: 'Multi-location high volume' },
            { name: 'Parts & Markup', amount: 2200000, color: '#f59e0b', desc: 'National fleet contracts' }
        ]
    }
};

function formatWfCurrency(num) {
    if (num >= 1000000) return '$' + (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return '$' + (num / 1000).toFixed(0) + 'K';
    return '$' + num;
}

function setWaterfallStage(stage) {
    const data = waterfallStages[stage];
    const stack = document.getElementById('wfStack');
    const legend = document.getElementById('wfLegend');
    const totalEl = document.getElementById('wfTotal');

    // Update tab buttons
    document.querySelectorAll('.wf-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.stage === stage);
    });

    // Calculate max height reference (Year 3 total for consistent scale)
    const maxTotal = waterfallStages.year3.total;
    const barMaxHeight = 220; // px

    // Build segments HTML (start at height 0 for animation)
    stack.innerHTML = data.segments.map(seg => {
        const heightPx = (seg.amount / maxTotal) * barMaxHeight;
        return `<div class="wf-segment" style="height: 0; background: ${seg.color};" data-target-height="${heightPx}">
            <span class="wf-segment-label">${formatWfCurrency(seg.amount)}</span>
            <div class="wf-tooltip">
                <strong>${formatWfCurrency(seg.amount)}</strong>
                ${seg.name}: ${seg.desc}
            </div>
        </div>`;
    }).join('');

    // Build legend
    legend.innerHTML = data.segments.map(seg => `
        <div class="wf-legend-item">
            <div class="wf-legend-dot" style="background: ${seg.color};"></div>
            <span class="wf-legend-text">${seg.name}</span>
            <span class="wf-legend-amount">${formatWfCurrency(seg.amount)}</span>
        </div>
    `).join('');

    // Animate bars growing
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            document.querySelectorAll('.wf-segment').forEach((seg, i) => {
                setTimeout(() => {
                    seg.style.height = seg.dataset.targetHeight + 'px';
                    // Show label after bar finishes growing
                    setTimeout(() => {
                        const label = seg.querySelector('.wf-segment-label');
                        if (label && parseFloat(seg.dataset.targetHeight) > 25) {
                            label.classList.add('visible');
                        }
                    }, 600);
                }, i * 150); // Stagger each segment
            });
        });
    });

    // Animated counter for total
    totalEl.classList.remove('animating');
    void totalEl.offsetWidth; // force reflow
    totalEl.classList.add('animating');

    let currentCount = 0;
    const targetCount = data.total;
    const duration = 1200;
    const steps = 40;
    const increment = targetCount / steps;
    const stepTime = duration / steps;

    const counter = setInterval(() => {
        currentCount += increment;
        if (currentCount >= targetCount) {
            currentCount = targetCount;
            clearInterval(counter);
        }
        totalEl.textContent = formatWfCurrency(Math.round(currentCount));
    }, stepTime);
}

// Auto-trigger waterfall when section scrolls into view
const waterfallObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            setWaterfallStage('day1');
            waterfallObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.3 });

const marketSection = document.getElementById('market');
if (marketSection) {
    waterfallObserver.observe(marketSection);
}
