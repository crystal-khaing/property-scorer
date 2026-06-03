import React, { useMemo, useState, useEffect } from "react";
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip
} from "recharts";
import {
  Info, RefreshCw, SlidersHorizontal, Wand2,
  TrendingUp, ShieldCheck, Home, DollarSign, MapPin,
  Palette, FileDown
} from "lucide-react";
// ------- Helpers -------
const clamp = (v, min=0, max=100) => Math.max(min, Math.min(max, v));
const safeNum = (v, d=0) => Number.isFinite(v) ? v : d;

function ringColor(score){
  if(score >= 90) return "from-emerald-600 via-emerald-400 to-lime-300";
  if(score >= 75) return "from-lime-500 via-green-400 to-teal-300";
  if(score >= 60) return "from-amber-400 via-orange-300 to-amber-200";
  if(score >= 45) return "from-orange-500 via-rose-400 to-amber-300";
  return "from-rose-600 via-pink-500 to-red-400";
}

const DEFAULT_INPUTS = {
  price: 550000,
  assessedValue: 600000,
  yearBuilt: 1998,
  sqft: 2200,
  lotSqft: 6000,
  beds: 4,
  baths: 3,
  condition: 3,
  renoBudget: 20000,
  propertyType: "Single Family",
  yoyAppreciation: 4.2,
  daysOnMarket: 21,
  interestRate: 6.8,
  vacancyRate: 6,
  crimeIndex: 35,
  schoolRating: 7,
  walkScore: 62,
  unemploymentRate: 3.9,
  propertyTaxRate: 1.25,
  hoaMonthly: 0,
  rentEstimate: 3200,
  maintenancePct: 1.0,
  capexAnnual: 2500,
  insuranceAnnual: 1800,
};

const DEFAULT_WEIGHTS = {
  valuation: 0.26,
  growth: 0.22,
  cashflow: 0.20,
  risk: 0.18,
  livability: 0.14,
};

function useScoring(inputs, weights){
  return useMemo(()=>{
    const price = safeNum(inputs.price, 0);
    const assessed = safeNum(inputs.assessedValue, price);
    const rent = safeNum(inputs.rentEstimate, 0);
    const annualRent = rent * 12;

    // Valuation: undervaluation + yield + size efficiency
    const undervaluation = clamp(50 + (assessed ? ((assessed - price) / assessed) * 100 : 0), 0, 100);
    const grossYield = price > 0 ? (annualRent / price) * 100 : 0;
    const yieldScore = clamp(((grossYield - 4) / (12 - 4)) * 100, 0, 100);
    const sizeEfficiency = inputs.sqft > 0 ? clamp(100 - Math.abs((inputs.sqft / Math.max(1, inputs.beds)) - 500) / 5, 0, 100) : 50;
    const valuation = 0.45*undervaluation + 0.45*yieldScore + 0.10*sizeEfficiency;

    // Growth: appreciation + demand signals
    const apprScore = clamp(((inputs.yoyAppreciation - 0) / (8 - 0)) * 100, 0, 100);
    const domScore = clamp(100 - (inputs.daysOnMarket / 60) * 100, 0, 100);
    const employmentScore = clamp(100 - (inputs.unemploymentRate / 9) * 100, 0, 100);
    const growth = 0.5*apprScore + 0.3*domScore + 0.2*employmentScore;

    // Cash flow
    const taxes = (inputs.propertyTaxRate/100) * price;
    const hoa = inputs.hoaMonthly * 12;
    const maintenance = (inputs.maintenancePct/100) * price;
    const expenses = taxes + hoa + maintenance + inputs.capexAnnual + inputs.insuranceAnnual;
    const noi = Math.max(0, annualRent - expenses);
    const netYield = price>0 ? (noi / price) * 100 : 0;
    const netYieldScore = clamp(((netYield - 2) / (8 - 2)) * 100, 0, 100);
    const cashflow = netYieldScore;

    // Risk
    const crimeScore = clamp(100 - inputs.crimeIndex, 0, 100);
    const vacancyScore = clamp(100 - ((inputs.vacancyRate - 2) / (12 - 2)) * 100, 0, 100);
    const ratePenalty = clamp(100 - ((inputs.interestRate - 4) / (9 - 4)) * 100, 0, 100);
    const age = new Date().getFullYear() - inputs.yearBuilt;
    const ageAdj = clamp(100 - (age/80)*100 + (inputs.condition-3)*10, 0, 100);
    const risk = 0.35*crimeScore + 0.25*vacancyScore + 0.20*ratePenalty + 0.20*ageAdj;

    // Livability
    const schoolScore = clamp((inputs.schoolRating/10)*100, 0, 100);
    const walkScore = clamp(inputs.walkScore, 0, 100);
    const bathBalance = clamp(100 - Math.abs(inputs.beds - inputs.baths) * 12, 0, 100);
    const livability = 0.45*schoolScore + 0.35*walkScore + 0.20*bathBalance;

    // Aggregate
    const weighted = (
      weights.valuation*valuation +
      weights.growth*growth +
      weights.cashflow*cashflow +
      weights.risk*risk +
      weights.livability*livability
    );
    const score = clamp(weighted, 1, 100);

    const drivers = [
      { name: "Valuation", value: Math.round(valuation) },
      { name: "Growth", value: Math.round(growth) },
      { name: "Cash Flow", value: Math.round(cashflow) },
      { name: "Risk", value: Math.round(risk) },
      { name: "Livability", value: Math.round(livability) },
    ];

    const radar = drivers.map(d=>({ metric: d.name, score: d.value }));

    const guidance = [];
    if (grossYield < 7) guidance.push("Yield < 7% — consider a lower offer or higher rent strategy.");
    if (inputs.daysOnMarket > 45) guidance.push("DOM > 45 suggests weak demand — negotiate aggressively.");
    if (inputs.crimeIndex > 50) guidance.push("High crime index — revisit block-level comps and insurance costs.");
    if (inputs.propertyTaxRate > 1.5) guidance.push("Property taxes are heavy — stress-test cash flow.");
    if (inputs.condition <= 2) guidance.push("Condition is subpar — allocate more for renovations or adjust price.");

    const targetNetYield = 5;
    const targetPrice = annualRent>0 ? Math.max(1, (noi / (targetNetYield/100))) : price;

    return {
      score: Math.round(score),
      subs: { valuation, growth, cashflow, risk, livability },
      figures: { grossYield: (annualRent/Math.max(1,price))*100, netYield, noi, taxes, expenses, annualRent, targetPrice },
      drivers, radar, guidance
    };
  }, [inputs, weights]);
}

// Components

function Field({label, tooltip, children}){
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 mb-1">
        <label className="text-sm text-gray-600 font-medium">{label}</label>
        {tooltip && (
          <Info className="h-4 w-4 text-gray-400 cursor-help" title={tooltip} />
        )}
      </div>
      {children}
    </div>
  );
}

function NumberInput({value, onChange, min, max, step=1, placeholder}){
  return (
    <input
      type="number"
      className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
      value={value}
      onChange={e=> {
        let val = e.target.value;
        if(val === "") onChange("");
        else {
          const num = Number(val);
          if((min !== undefined && num < min) || (max !== undefined && num > max)) return;
          onChange(num);
        }
      }}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
    />
  );
}

function BigScore({score, theme}){
  const gradient = ringColor(score);
  const glowColor = theme === 'ocean' ? "shadow-[0_0_40px_rgba(59,130,246,0.5)]"
                  : theme === 'sunset' ? "shadow-[0_0_40px_rgba(249,115,22,0.5)]"
                  : "shadow-[0_0_40px_rgba(16,185,129,0.5)]";
  return (
    <div className={`mx-auto grid place-items-center ${glowColor}`}>
      <div className={`relative h-44 w-44 rounded-full bg-gradient-to-br ${gradient} p-1 shadow-lg`}>
        <div className="h-full w-full rounded-full bg-white grid place-items-center">
          <div className="text-center">
            <div className="text-black text-6xl font-extrabold tracking-tight">{score}</div>
            <div className="text-xs uppercase tracking-wide text-gray-500 mt-1">Score / 100</div>
          </div>
        </div>
      </div>
    </div>
  );
}



export default function RealEstatePotentialPro(){
  const [inputs, setInputs] = useState(DEFAULT_INPUTS);
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const [tab, setTab] = useState("basics");
  const [theme, setTheme] = useState("emerald"); // emerald | ocean | sunset
  const progressBarColor = theme === 'ocean' ? 'bg-sky-500' : theme === 'sunset' ? 'bg-orange-500' : 'bg-green-500';
  const sliderTrackColor = theme === 'ocean' ? 'bg-sky-500' : theme === 'sunset' ? 'bg-orange-500' : 'bg-emerald-500';
  const mapPinColors = {
    emerald: "#10B981", // Tailwind emerald-500 hex
    ocean: "#3B82F6",   // Tailwind sky-600 hex
    sunset: "#F97316",  // Tailwind orange-500 hex
  };
  const mapPinColor = mapPinColors[theme] || "#10B981"; // fallback emerald
  

  useEffect(() => {
    const min = 5;
    const max = 50;
  
    Object.entries(weights).forEach(([key, value]) => {
      const slider = document.querySelector(`input[data-key="${key}"]`);
      if (slider) {
       // value * 100 gives the slider value (between 5 and 50)
       const sliderValue = value * 100;
       // Calculate fill percent based on min/max range
        const fillPercent = ((sliderValue - min) / (max - min)) * 100;
        
        // Clamp between 0 and 100 just to be safe
        const clampedFill = Math.min(100, Math.max(0, fillPercent));

        slider.style.setProperty('--slider-value', `${clampedFill}%`);
      }
    });
  }, [weights]);



  const { score, subs, figures, drivers, radar, guidance } = useScoring(inputs, weights);

  const update = (key) => (v) => setInputs(prev=>({...prev, [key]: v}));

  const totalWeight = Object.values(weights).reduce((a,b)=>a+b,0) || 1;
  const normalizedWeights = Object.fromEntries(Object.entries(weights).map(([k,v])=>[k, v/totalWeight]));

  const presets = {
    "Move-in Ready SFH": { ...DEFAULT_INPUTS },
    "Fixer-Upper": {
      ...DEFAULT_INPUTS,
      price: 420000, assessedValue: 520000, condition: 2, renoBudget: 60000,
      yoyAppreciation: 3.5, daysOnMarket: 58, rentEstimate: 2900, crimeIndex: 48, schoolRating: 6
    },
    "Urban Condo": {
      ...DEFAULT_INPUTS,
      propertyType: "Condo", price: 480000, assessedValue: 500000, sqft: 900, beds: 2, baths: 2,
      walkScore: 92, schoolRating: 8, hoaMonthly: 550, rentEstimate: 3500, lotSqft: 0
    },
    "Investor Duplex": {
      ...DEFAULT_INPUTS,
      propertyType: "Duplex", price: 650000, assessedValue: 700000, beds: 4, baths: 4, sqft: 2600,
      rentEstimate: 4600, vacancyRate: 5, propertyTaxRate: 1.4, yoyAppreciation: 5.1
    }
  };

  const loadPreset = (k)=> setInputs(presets[k]);
  const reset = ()=> { setInputs(DEFAULT_INPUTS); setWeights(DEFAULT_WEIGHTS); };

  // Simple JSON export
  const exportJSON = () => {
    const payload = { inputs, weights, results: { score, subs, figures } };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `property-score-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Theme colors for charts
  const chartColor = theme === 'ocean' ? '#3b82f6' : theme === 'sunset' ? '#f97316' : '#10b981';
  const chartStroke = theme === 'ocean' ? '#2563eb' : theme === 'sunset' ? '#ea580c' : '#059669';

  // Modal state
  const [showModal, setShowModal] = useState(false);

  return (
    <div data-theme={theme} className={`min-h-screen bg-gradient-to-b ${theme==='ocean' ? 'from-black to-black' : theme==='sunset' ? 'from-black to-black' : 'from-black to-black'} text-white p-6`}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Home className={`h-7 w-7 ${theme==='ocean' ? 'text-sky-600' : theme==='sunset' ? 'text-orange-600' : 'text-emerald-600'}`} />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Real Estate Potential Score</h1>
              <p className="text-sm text-gray-300">Predict a property's potential with a transparent 1–100 score.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-md text-sm"
              title="Model assumptions & weights"
            >
              <Info className="h-4 w-4" /> Assumptions
            </button>

            <button
              onClick={reset}
              className="flex items-center gap-2 border border-gray-300 hover:border-gray-400 rounded-md px-3 py-1 text-sm"
              title="Reset inputs and weights"
            >
              <RefreshCw className="h-4 w-4" /> Reset
            </button>

            <button
              onClick={exportJSON}
              className="flex items-center gap-2 border border-gray-300 hover:border-gray-400 rounded-md px-3 py-1 text-sm"
              title="Export data as JSON"
            >
              <FileDown className="h-4 w-4" /> Export
            </button>

            <div className="flex items-center gap-1 border border-gray-300 rounded-md px-2 py-1 text-sm">
              <Palette className="h-4 w-4 text-gray-500" />
              <select className="outline-none bg-transparent" value={theme} onChange={e=>setTheme(e.target.value)}>
                <option value="emerald">Emerald</option>
                <option value="ocean">Ocean</option>
                <option value="sunset">Sunset</option>
              </select>
            </div>
          </div>
        </header>

        {/* Modal */}
        {showModal && (
          <div
            className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50"
            onClick={() => setShowModal(false)}
          >
            <div
              className="bg-white max-w-xl p-6 rounded-lg shadow-lg"
              onClick={e => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-title"
            >
              <h2 id="modal-title" className="text-xl font-bold mb-3">Model assumptions & weights</h2>
              <div className="space-y-3 text-sm text-gray-600">
                <p>
                  Five dimensions: <b>Valuation</b>, <b>Growth</b>, <b>Cash Flow</b>, <b>Risk</b>, and <b>Livability</b>. Each becomes a 0–100 sub-score, combined via adjustable weights.
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Gross yield band: 4–12%; Net yield band: 2–8%.</li>
                  <li>DOM band: 0–60 days; Unemployment band: 0–9%.</li>
                  <li>Crime index: 0 (best) → 100 (worst). Schools: 1–10. Walk Score: 0–100.</li>
                </ul>
                <p>Screening tool only — not appraisal or financial advice.</p>
                <button
                  className="mt-4 px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded"
                  onClick={() => setShowModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 ">

          {/* Left: Inputs */}
          <div className="lg:col-span-2 space-y-6">
            {/* Inputs Card */}
            <div className="bg-black rounded-lg shadow p-6 border border-gray-700">
              <div className="flex items-center gap-2 mb-4">
                <SlidersHorizontal className="h-5 w-5 text-gray-200" />
                <h2 className="text-lg font-semibold">Property Inputs</h2>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-gray-300 mb-4">
                {["basics", "market", "income"].map(t => (
                  <button
                    key={t}
                    className={`flex-1 py-2 text-sm font-medium rounded-t-md transition-colors
                      ${tab === t 
                        ? "bg-white text-black shadow" 
                        : "bg-gray-500 bg-opacity-50 text-white hover:bg-opacity-90 hover:text-black"}`}
                    onClick={() => setTab(t)}
                  >
                    {t === "basics" ? "Basics" : t === "market" ? "Market" : "Income & Costs"}
                  </button>
                ))}
              </div>
              {/* Tab content */}
              {tab === "basics" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-black">
                  <Field>
                    <label class="text-sm text-white font-medium">Property Type</label>
                    <input
                      type="text"
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      value={inputs.propertyType}
                      onChange={e => update("propertyType")(e.target.value)}
                    />
                  </Field>
                  <Field>
                    <label class="text-sm text-white font-medium">Price ($)</label>
                    <NumberInput value={inputs.price} onChange={update("price")} min={1} step={1000} />
                  </Field>
                  <Field> {/*label = "Assessed Value ($) tooltip="Local tax assessor or recent appraisal."*/}
                    <label class="text-sm text-white font-medium">Assessed Value ($)</label>
                    <NumberInput value={inputs.assessedValue} onChange={update("assessedValue")} min={0} step={1000} />
                  </Field>
                  <Field>
                    <label class="text-sm text-white font-medium">Year Built</label>
                    <NumberInput value={inputs.yearBuilt} onChange={update("yearBuilt")} min={1900} max={new Date().getFullYear()} />
                  </Field>
                  <Field>
                    <label class="text-sm text-white font-medium">Beds</label>
                    <NumberInput value={inputs.beds} onChange={update("beds")} min={0} step={1} />
                  </Field>
                  <Field>
                    <label class="text-sm text-white font-medium">Baths</label>
                    <NumberInput value={inputs.baths} onChange={update("baths")} min={0} step={1} />
                  </Field>
                  <Field>
                    <label class="text-sm text-white font-medium">Interior (sqft)</label>
                    <NumberInput value={inputs.sqft} onChange={update("sqft")} min={0} step={10} />
                  </Field>
                  <Field>
                    <label class="text-sm text-white font-medium">Lot (sqft)</label>
                    <NumberInput value={inputs.lotSqft} onChange={update("lotSqft")} min={0} step={10} />
                  </Field>
                  <Field>
                    <label class="text-sm text-white font-medium">Condition</label>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      step={1}
                      value={inputs.condition}
                      onChange={e => setInputs(prev => ({ ...prev, condition: Number(e.target.value) }))}
                      className="w-full condition-slider"
                      style={{ '--value': ((inputs.condition - 1) / 4) * 100 }}
                    />
                    <div className="text-xs text-white text-center mt-1">{inputs.condition}</div>
                  </Field>
                  <Field>
                    <label class="text-sm text-white font-medium">Reno Budget ($)</label>
                    <NumberInput value={inputs.renoBudget} onChange={update("renoBudget")} min={0} step={1000} />
                  </Field>
                </div>
              )}

              {tab === "market" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-white bg-black">
                  <Field>
                    <label class="text-sm text-white font-medium">YoY Appreciation (%)</label>
                    <NumberInput value={inputs.yoyAppreciation} onChange={update("yoyAppreciation")} step={0.1} />
                  </Field>
                  <Field>
                    <label class="text-sm text-white font-medium">Days on Market</label>
                    <NumberInput value={inputs.daysOnMarket} onChange={update("daysOnMarket")} step={1} />
                  </Field>
                  <Field>
                    <label class="text-sm text-white font-medium">Interest Rate (%)</label>
                    <NumberInput value={inputs.interestRate} onChange={update("interestRate")} step={0.1} />
                  </Field>
                  <Field>
                    <label class="text-sm text-white font-medium">Vacancy Rate (%)</label>
                    <NumberInput value={inputs.vacancyRate} onChange={update("vacancyRate")} step={0.1} />
                  </Field>
                  <Field>
                    <label class="text-sm text-white font-medium">Crime Index (0–100)</label>
                    <NumberInput value={inputs.crimeIndex} onChange={update("crimeIndex")} step={1} />
                  </Field>
                  <Field>
                    <label class="text-sm text-white font-medium">School Rating (1–10)</label>
                    <NumberInput value={inputs.schoolRating} onChange={update("schoolRating")} step={1} />
                  </Field>
                  <Field>
                    <label class="text-sm text-white font-medium">Walk Score (0–100)</label>
                    <NumberInput value={inputs.walkScore} onChange={update("walkScore")} step={1} />
                  </Field>
                  <Field>
                    <label class="text-sm text-white font-medium">Unemployment Rate (%)</label>
                    <NumberInput value={inputs.unemploymentRate} onChange={update("unemploymentRate")} step={0.1} />
                  </Field>
                  <Field>
                    <label class="text-sm text-white font-medium">Property Tax Rate (%)</label>
                    <NumberInput value={inputs.propertyTaxRate} onChange={update("propertyTaxRate")} step={0.01} />
                  </Field>
                  <Field>
                  <label class="text-sm text-white font-medium">HOA ($/mo)</label>
                    <NumberInput value={inputs.hoaMonthly} onChange={update("hoaMonthly")} step={10} />
                  </Field>
                </div>
              )}

              {tab === "income" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-black">
                  <Field>
                    <label className="text-sm text-white font-medium">Rent Estimate ($/mo)</label>
                    <NumberInput value={inputs.rentEstimate} onChange={update("rentEstimate")} step={50} />
                  </Field>
                  <Field>
                    <label className="text-sm text-white font-medium">Maintenance (%/yr)</label>
                    <NumberInput value={inputs.maintenancePct} onChange={update("maintenancePct")} step={0.1} />
                  </Field>
                  <Field>
                    <label className="text-sm text-white font-medium">CapEx ($/yr)</label>
                    <NumberInput value={inputs.capexAnnual} onChange={update("capexAnnual")} step={100} />
                  </Field>
                  <Field>
                    <label className="text-sm text-white font-medium">Insurance ($/yr)</label>
                    <NumberInput value={inputs.insuranceAnnual} onChange={update("insuranceAnnual")} step={50} />
                  </Field>
                </div>
              )}

              {/* Presets and badges */}
              <div className="mt-6 flex flex-wrap justify-between items-center gap-3">
                <div className="flex gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 bg-gray-600 px-3 py-1 rounded text-xs text-white">
                    <DollarSign className="h-3 w-3" /> Gross Yield {figures.grossYield ? figures.grossYield.toFixed(1) + "%" : "—"}
                  </span>
                  <span className="inline-flex items-center gap-1 bg-gray-600 px-3 py-1 rounded text-xs text-white">
                    <ShieldCheck className="h-3 w-3" /> Net Yield {safeNum(figures.netYield).toFixed(1) + "%"}
                  </span>
                  <span className="inline-flex items-center gap-1 bg-gray-600 px-3 py-1 rounded text-xs text-white">
                    <TrendingUp className="h-3 w-3" /> NOI ${safeNum(figures.noi).toLocaleString()}
                  </span>
                </div>
                <div className="flex gap-2 flex-wrap text-gray-700">
                  {Object.keys(presets).map(k => (
                    <button
                      key={k}
                      onClick={() => loadPreset(k)}
                      className="px-3 py-1 border border-gray-300 rounded text-xs bg-white shadow-md hover:shadow-lg hover:bg-gray-100 transition-shadow"
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Weights Card */}
            <div className="bg-gray-900 rounded-lg shadow p-6">
              <div className="flex items-center gap-2 mb-4 text-white">
                <Wand2 className="h-5 w-5 text-white" />
                <h2 className="text-lg font-semibold">Weights</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {Object.entries(weights).map(([k, v]) => (
                  <div key={k} className="space-y-1">
                    <div className="flex justify-between text-xs text-white">
                      <span className="capitalize">{k}</span>
                      <span>{(normalizedWeights[k] * 100).toFixed(0)}%</span>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={50}
                      step={1}
                      value={v * 100}
                      data-key={k} 
                      onChange={e => setWeights(prev => ({ ...prev, [k]: e.target.value / 100 }))}
                      className="w-full weight-slider"
                    />


                  </div>
                ))}
              </div>
              <p className="text-xs text-white mt-2">Weights auto-normalize to 100%.</p>
            </div>
          </div>

          {/* Right: Score & Insights */}
          <div className="lg:col-span-1 space-y-6 sticky top-6">

            <div className="bg-black rounded-lg shadow p-6">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="h-5 w-5" color={mapPinColor} />

                <h2 className="text-lg font-semibold text-white">Score & Insights</h2>
              </div>

              <BigScore score={score} theme={theme} />

              {/* Sub scores bars */}
              <div className="grid grid-cols-2 gap-3 mt-6">
                {subs && Object.entries(subs).map(([k,v]) => (
                  <div key={k} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium capitalize">
                      <span>{k}</span>
                      <span>{Math.round(v)}</span>
                    </div>
                    <div className="h-4 bg-gray-200 rounded overflow-hidden">
                      <div
                        className={`${progressBarColor} h-full`}
                        style={{width: `${Math.round(v)}%`}}
                      />

                    </div>
                  </div>
                ))}
              </div>

              {/* Radar chart */}
              <div className="h-56 mt-6">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radar} outerRadius={90}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="metric" />
                    <PolarRadiusAxis angle={45} domain={[0, 100]} />
                    <Radar name="Score" dataKey="score" fill={chartColor} stroke={chartStroke} fillOpacity={0.5} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Bar chart for drivers */}
              <div className="h-52 mt-6">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={drivers}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis domain={[0, 100]} />
                    <RTooltip />
                    <Bar dataKey="value" radius={[8,8,0,0]} fill={chartColor} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Suggested offer */}
              <div className="rounded-2xl border p-4 mt-6" style={{background: `${chartColor}20`}}>
                <div className="text-sm font-medium text-white">Suggested Offer (5% target net yield)</div>
                <div className="text-2xl font-bold text-white">${Number.isFinite(figures.targetPrice) ? Math.round(figures.targetPrice).toLocaleString() : "—"}</div>
                <div className="text-xs text-gray-300">Based on current NOI and a target net yield of 5%.</div>
              </div>

              {/* Guidance */}
              <div className="space-y-2 mt-6">
                <div className="text-sm font-medium">What moved your score</div>
                {guidance.length === 0 ? (
                  <p className="text-xs text-gray-300">All core signals look balanced. Consider sensitivity-testing weights.</p>
                ) : (
                  <ul className="list-disc pl-5 text-xs text-gray-200 space-y-1">
                    {guidance.map((g,i)=> <li key={i}>{g}</li>)}
                  </ul>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="text-xs text-gray-400 space-y-3">
              <div>
                <strong>How to use</strong>
                <p>Start with rough numbers. Tune weights to your strategy (value vs. cash flow). Use the guidance to identify negotiation levers or diligence items.</p>
              </div>
              <div>
                <strong>Sensitivity ideas</strong>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Shift 5–10% weight between Growth and Cash Flow.</li>
                  <li>Raise target net yield if rates are rising.</li>
                  <li>Stress-test taxes, HOA, and vacancy ±25%.</li>
                </ul>
              </div>
              <div>
                <strong>Disclaimer</strong>
                <p>The score is a heuristic. Always verify comps, local taxes, zoning, renovation scope, and legal disclosures before making offers.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}