import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  AlertTriangle, 
  CheckCircle, 
  TrendingDown, 
  DollarSign, 
  Plus, 
  RefreshCw, 
  Trash2, 
  Share2, 
  Download, 
  Store, 
  Calendar, 
  ShieldAlert, 
  Sparkles, 
  Tag, 
  Package, 
  FileText, 
  Settings, 
  ChevronRight, 
  ArrowUpRight, 
  Check, 
  Info, 
  Copy, 
  X, 
  Layers, 
  BarChart3,
  Archive,
  Search,
  Filter,
  Save,
  Clock,
  Send,
  Sliders,
  ExternalLink,
  Percent
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell, 
  LineChart, 
  Line, 
  CartesianGrid 
} from 'recharts';

// ==========================================
// TYPES & DATA MODELS
// ==========================================

export type BusinessType = 
  | 'Bakery or cake shop'
  | 'Grocery or fruit and vegetable shop'
  | 'Restaurant or café'
  | 'Food stall'
  | 'Small food producer'
  | 'Other food business';

export type RiskLevel = 'FRESH' | 'APPROACHING_DATE' | 'EXPIRED' | 'UNSAFE_OR_QUESTIONABLE' | 'UNKNOWN';

export interface BusinessProfile {
  businessName: string;
  businessType: BusinessType;
  ownerName: string;
  currency: string;
  preferredLanguage: 'en' | 'hi' | 'mr';
  minAcceptableMarginPercent: number; // e.g. 10%
  warningDaysThreshold: number; // days before expiry to alert
  isOnboarded: boolean;
}

export interface InventoryBatch {
  id: string;
  productName: string;
  category: string;
  quantity: number;
  initialQuantity: number;
  unit: 'pcs' | 'kg' | 'g' | 'L' | 'packs';
  purchaseCostPerUnit: number;
  sellingPricePerUnit: number;
  dateReceived: string; // YYYY-MM-DD
  expiryDate: string; // YYYY-MM-DD
  bestBeforeDate?: string; // YYYY-MM-DD
  batchNumber: string;
  storageNotes: string;
  conditionNotes: string;
  isUnsafe: boolean;
  isArchived: boolean;
  createdAt: number;
}

export interface SaleTransaction {
  id: string;
  batchId: string;
  productName: string;
  quantitySold: number;
  unitPrice: number;
  saleDate: string;
  isRescueSale: boolean;
  originalUnitPrice: number;
  totalRevenue: number;
  costOfSoldStock: number;
}

export interface WasteRecord {
  id: string;
  batchId: string;
  productName: string;
  quantityWasted: number;
  unit: string;
  costPerUnit: number;
  totalCostWasted: number;
  reason: 'spoilage' | 'expiry' | 'damage' | 'preparation_surplus' | 'other';
  dateRecorded: string;
  notes: string;
}

export interface DiscountCampaign {
  id: string;
  batchId: string;
  productName: string;
  originalPrice: number;
  discountedPrice: number;
  discountPercent: number;
  estimatedMarginPercent: number;
  quantityOffered: number;
  language: 'en' | 'hi' | 'mr';
  tone: 'friendly' | 'professional' | 'festive' | 'urgent';
  whatsappMessage: string;
  instagramCaption: string;
  headline: string;
  callToAction: string;
  posterVisualConcept: string;
  status: 'draft' | 'approved' | 'completed' | 'cancelled';
  createdAt: string;
  expiresAt?: string;
}

export interface AIRecommendation {
  id: string;
  batchId: string;
  productName: string;
  recommendationType: 'PRICE_DROP' | 'BUNDLE_SALE' | 'PRODUCTION_CUT' | 'PRIORITIZE_SHELF' | 'MANUAL_INSPECTION';
  title: string;
  explanation: string;
  supportingObservations: string;
  suggestedAction: string;
  suggestedDiscountPercent?: number;
  assumptions: string;
  requiresHumanReview: boolean;
  createdAt: string;
}

// ==========================================
// FOOD SAFETY & RISK CLASSIFICATION ENGINE
// (Strict Deterministic Business Logic)
// ==========================================

export function calculateDaysRemaining(targetDateStr: string): number {
  if (!targetDateStr) return 999;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(targetDateStr);
  target.setHours(0, 0, 0, 0);
  const diffTime = target.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function classifyBatchRisk(batch: InventoryBatch, thresholdDays: number = 2): {
  risk: RiskLevel;
  reason: string;
  daysRemaining: number;
  isEligibleForSale: boolean;
} {
  if (batch.isUnsafe) {
    return {
      risk: 'UNSAFE_OR_QUESTIONABLE',
      reason: 'Flagged for questionable condition or storage failure. Must not be sold.',
      daysRemaining: -999,
      isEligibleForSale: false,
    };
  }

  if (!batch.expiryDate) {
    return {
      risk: 'UNKNOWN',
      reason: 'No applicable expiry date recorded. Manual safety check required.',
      daysRemaining: 999,
      isEligibleForSale: false,
    };
  }

  const days = calculateDaysRemaining(batch.expiryDate);

  if (days < 0) {
    return {
      risk: 'EXPIRED',
      reason: `Expired on ${batch.expiryDate} (${Math.abs(days)} days ago). STRICTLY INELIGIBLE for sale or rescue campaigns.`,
      daysRemaining: days,
      isEligibleForSale: false,
    };
  }

  if (days <= thresholdDays) {
    return {
      risk: 'APPROACHING_DATE',
      reason: days === 0 
        ? 'Reaches expiration TODAY. Urgent prioritization needed.'
        : `Reaches expiration in ${days} day(s). Candidate for Rescue Discount before expiry.`,
      daysRemaining: days,
      isEligibleForSale: true,
    };
  }

  return {
    risk: 'FRESH',
    reason: `Fresh inventory. ${days} days remaining until scheduled use-by/expiry date.`,
    daysRemaining: days,
    isEligibleForSale: true,
  };
}

export function calculateDeterministicPricing(
  costPrice: number,
  originalSellingPrice: number,
  discountPercent: number,
  minAcceptableMarginPercent: number
): {
  proposedPrice: number;
  estimatedMarginPercent: number;
  isMarginViolated: boolean;
  grossProfitPerUnit: number;
} {
  const safeDiscount = Math.max(0, Math.min(90, discountPercent));
  const proposedPrice = Math.round((originalSellingPrice * (1 - safeDiscount / 100)) * 100) / 100;
  const grossProfitPerUnit = Math.round((proposedPrice - costPrice) * 100) / 100;
  
  const estimatedMarginPercent = proposedPrice > 0 
    ? Math.round(((proposedPrice - costPrice) / proposedPrice) * 1000) / 10 
    : 0;

  const isMarginViolated = estimatedMarginPercent < minAcceptableMarginPercent;

  return {
    proposedPrice,
    estimatedMarginPercent,
    isMarginViolated,
    grossProfitPerUnit,
  };
}

// ==========================================
// DEMO DATASET (Realistic Small Food Business)
// ==========================================

const getDemoToday = (offsetDays: number = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
};

const INITIAL_PROFILE: BusinessProfile = {
  businessName: 'Patil Artisan Bakery & Confectionery',
  businessType: 'Bakery or cake shop',
  ownerName: 'Prajot Kamble',
  currency: '₹',
  preferredLanguage: 'en',
  minAcceptableMarginPercent: 12,
  warningDaysThreshold: 2,
  isOnboarded: true,
};

const INITIAL_BATCHES: InventoryBatch[] = [
  {
    id: 'batch-001',
    productName: 'Belgian Chocolate Cream Eclairs',
    category: 'Fresh Pastries',
    quantity: 18,
    initialQuantity: 30,
    unit: 'pcs',
    purchaseCostPerUnit: 45,
    sellingPricePerUnit: 110,
    dateReceived: getDemoToday(-1),
    expiryDate: getDemoToday(1), // Approaching in 1 day
    batchNumber: 'BCL-204',
    storageNotes: 'Refrigerated display chiller (2°C - 4°C)',
    conditionNotes: 'Flaky crust, fresh dairy cream filling',
    isUnsafe: false,
    isArchived: false,
    createdAt: Date.now() - 86400000,
  },
  {
    id: 'batch-002',
    productName: 'Whole Wheat Sourdough Loaf (750g)',
    category: 'Artisanal Bread',
    quantity: 8,
    initialQuantity: 20,
    unit: 'pcs',
    purchaseCostPerUnit: 60,
    sellingPricePerUnit: 140,
    dateReceived: getDemoToday(-2),
    expiryDate: getDemoToday(0), // Expires TODAY
    batchNumber: 'WWS-109',
    storageNotes: 'Dry ambient bakery shelf',
    conditionNotes: 'Intact crust, baked fresh',
    isUnsafe: false,
    isArchived: false,
    createdAt: Date.now() - 172800000,
  },
  {
    id: 'batch-003',
    productName: 'Fresh Alphonso Mango Tartlets',
    category: 'Seasonal Fruit Desserts',
    quantity: 6,
    initialQuantity: 15,
    unit: 'pcs',
    purchaseCostPerUnit: 55,
    sellingPricePerUnit: 130,
    dateReceived: getDemoToday(-3),
    expiryDate: getDemoToday(-1), // EXPIRED yesterday
    batchNumber: 'MGT-092',
    storageNotes: 'Chiller shelf 2',
    conditionNotes: 'Glaze has separated, custard starting to sour',
    isUnsafe: false,
    isArchived: false,
    createdAt: Date.now() - 259200000,
  },
  {
    id: 'batch-004',
    productName: 'Butter Croissants (Box of 4)',
    category: 'Viennoiserie',
    quantity: 22,
    initialQuantity: 25,
    unit: 'packs',
    purchaseCostPerUnit: 120,
    sellingPricePerUnit: 240,
    dateReceived: getDemoToday(0),
    expiryDate: getDemoToday(3), // Fresh
    batchNumber: 'CRS-311',
    storageNotes: 'Covered bakery display case',
    conditionNotes: 'Golden and crisp',
    isUnsafe: false,
    isArchived: false,
    createdAt: Date.now(),
  },
  {
    id: 'batch-005',
    productName: 'Cold Brew Vanilla Dairy Milk Bottles',
    category: 'Beverages',
    quantity: 12,
    initialQuantity: 20,
    unit: 'pcs',
    purchaseCostPerUnit: 35,
    sellingPricePerUnit: 85,
    dateReceived: getDemoToday(-2),
    expiryDate: getDemoToday(5), // Fresh
    batchNumber: 'CBM-88',
    storageNotes: 'Beverage fridge',
    conditionNotes: 'Cap seal intact',
    isUnsafe: false,
    isArchived: false,
    createdAt: Date.now() - 100000000,
  },
  {
    id: 'batch-006',
    productName: 'Raw Blueberry Cheesecakes',
    category: 'Cakes',
    quantity: 4,
    initialQuantity: 6,
    unit: 'pcs',
    purchaseCostPerUnit: 250,
    sellingPricePerUnit: 550,
    dateReceived: getDemoToday(-4),
    expiryDate: getDemoToday(-2), // EXPIRED
    batchNumber: 'CHK-007',
    storageNotes: 'Cold display',
    conditionNotes: 'Visible surface dryness',
    isUnsafe: true, // Marked unsafe
    isArchived: false,
    createdAt: Date.now() - 300000000,
  }
];

const INITIAL_SALES: SaleTransaction[] = [
  {
    id: 'sale-001',
    batchId: 'batch-001',
    productName: 'Belgian Chocolate Cream Eclairs',
    quantitySold: 12,
    unitPrice: 77, // Discounted rescue sale
    saleDate: getDemoToday(0),
    isRescueSale: true,
    originalUnitPrice: 110,
    totalRevenue: 924,
    costOfSoldStock: 540,
  },
  {
    id: 'sale-002',
    batchId: 'batch-002',
    productName: 'Whole Wheat Sourdough Loaf (750g)',
    quantitySold: 12,
    unitPrice: 140, // Normal sale
    saleDate: getDemoToday(-1),
    isRescueSale: false,
    originalUnitPrice: 140,
    totalRevenue: 1680,
    costOfSoldStock: 720,
  }
];

const INITIAL_WASTE: WasteRecord[] = [
  {
    id: 'waste-001',
    batchId: 'batch-003',
    productName: 'Fresh Alphonso Mango Tartlets',
    quantityWasted: 9,
    unit: 'pcs',
    costPerUnit: 55,
    totalCostWasted: 495,
    reason: 'expiry',
    dateRecorded: getDemoToday(0),
    notes: 'Could not be sold prior to expiry date. Disposed of responsibly in compost.',
  }
];

const INITIAL_CAMPAIGNS: DiscountCampaign[] = [
  {
    id: 'camp-001',
    batchId: 'batch-001',
    productName: 'Belgian Chocolate Cream Eclairs',
    originalPrice: 110,
    discountedPrice: 77,
    discountPercent: 30,
    estimatedMarginPercent: 41.5,
    quantityOffered: 18,
    language: 'en',
    tone: 'friendly',
    whatsappMessage: '🥐 FreshSave Treat Alert! Enjoy our decadent Belgian Chocolate Cream Eclairs at 30% OFF this evening only (₹77 instead of ₹110). 18 pieces left baked fresh! Reserve via WhatsApp reply.',
    instagramCaption: 'Save Food, Eat Delicious! 🍫 Our signature Belgian Chocolate Eclairs are ready for dinner dessert at an exclusive 30% rescue discount. Grab yours before 9 PM today! #FreshSave #ZeroWasteFood #PuneBakery',
    headline: 'Evening Flash Rescue: 30% Off Belgian Eclairs!',
    callToAction: 'Reply YES to reserve your box now',
    posterVisualConcept: 'Minimalist warm ivory card showing dark chocolate drizzle graphic and bold badge: 30% OFF SAVE THE GOOD FOOD.',
    status: 'approved',
    createdAt: getDemoToday(0),
  }
];

// ==========================================
// MAIN COMPONENT
// ==========================================

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState<'overview' | 'inventory' | 'recommendations' | 'campaigns' | 'waste' | 'reports' | 'settings'>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Persistent States with LocalStorage fallback
  const [profile, setProfile] = useState<BusinessProfile>(() => {
    try {
      const saved = localStorage.getItem('freshsave_profile');
      return saved ? JSON.parse(saved) : INITIAL_PROFILE;
    } catch {
      return INITIAL_PROFILE;
    }
  });

  const [batches, setBatches] = useState<InventoryBatch[]>(() => {
    try {
      const saved = localStorage.getItem('freshsave_batches');
      return saved ? JSON.parse(saved) : INITIAL_BATCHES;
    } catch {
      return INITIAL_BATCHES;
    }
  });

  const [sales, setSales] = useState<SaleTransaction[]>(() => {
    try {
      const saved = localStorage.getItem('freshsave_sales');
      return saved ? JSON.parse(saved) : INITIAL_SALES;
    } catch {
      return INITIAL_SALES;
    }
  });

  const [waste, setWaste] = useState<WasteRecord[]>(() => {
    try {
      const saved = localStorage.getItem('freshsave_waste');
      return saved ? JSON.parse(saved) : INITIAL_WASTE;
    } catch {
      return INITIAL_WASTE;
    }
  });

  const [campaigns, setCampaigns] = useState<DiscountCampaign[]>(() => {
    try {
      const saved = localStorage.getItem('freshsave_campaigns');
      return saved ? JSON.parse(saved) : INITIAL_CAMPAIGNS;
    } catch {
      return INITIAL_CAMPAIGNS;
    }
  });

  const [aiRecommendations, setAiRecommendations] = useState<AIRecommendation[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Quick Action Modal states
  const [showAddInventoryModal, setShowAddInventoryModal] = useState(false);
  const [showRecordSaleModal, setShowRecordSaleModal] = useState(false);
  const [showRecordWasteModal, setShowRecordWasteModal] = useState(false);
  const [showCreateCampaignModal, setShowCreateCampaignModal] = useState(false);
  const [selectedBatchForAction, setSelectedBatchForAction] = useState<InventoryBatch | null>(null);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3800);
  };

  // Synchronize to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem('freshsave_profile', JSON.stringify(profile));
      localStorage.setItem('freshsave_batches', JSON.stringify(batches));
      localStorage.setItem('freshsave_sales', JSON.stringify(sales));
      localStorage.setItem('freshsave_waste', JSON.stringify(waste));
      localStorage.setItem('freshsave_campaigns', JSON.stringify(campaigns));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }, [profile, batches, sales, waste, campaigns]);

  // Derived Business Statistics
  const activeBatches = useMemo(() => batches.filter(b => !b.isArchived && b.quantity > 0), [batches]);

  const classifiedBatches = useMemo(() => {
    return activeBatches.map(b => ({
      batch: b,
      ...classifyBatchRisk(b, profile.warningDaysThreshold),
    }));
  }, [activeBatches, profile.warningDaysThreshold]);

  const atRiskBatches = useMemo(() => {
    return classifiedBatches.filter(item => item.risk === 'APPROACHING_DATE' && item.isEligibleForSale);
  }, [classifiedBatches]);

  const expiredBatches = useMemo(() => {
    return classifiedBatches.filter(item => item.risk === 'EXPIRED' || item.risk === 'UNSAFE_OR_QUESTIONABLE');
  }, [classifiedBatches]);

  // Value of at-risk inventory (selling price * quantity)
  const estimatedAtRiskValue = useMemo(() => {
    return atRiskBatches.reduce((acc, curr) => acc + (curr.batch.sellingPricePerUnit * curr.batch.quantity), 0);
  }, [atRiskBatches]);

  // Recorded Waste Cost (factual historical records)
  const totalRecordedWasteCost = useMemo(() => {
    return waste.reduce((acc, curr) => acc + curr.totalCostWasted, 0);
  }, [waste]);

  // Actual Revenue from Rescue Sales
  const rescueSalesRevenue = useMemo(() => {
    return sales
      .filter(s => s.isRescueSale)
      .reduce((acc, curr) => acc + curr.totalRevenue, 0);
  }, [sales]);

  // Estimated Cost Recovered through rescue sales (cost basis saved from being disposed as 0)
  const rescueCostRecovered = useMemo(() => {
    return sales
      .filter(s => s.isRescueSale)
      .reduce((acc, curr) => acc + curr.costOfSoldStock, 0);
  }, [sales]);

  // Reset demo data handler
  const handleResetDemoData = () => {
    if (window.confirm('Reset all business data to the standard realistic hackathon demo dataset?')) {
      setProfile(INITIAL_PROFILE);
      setBatches(INITIAL_BATCHES);
      setSales(INITIAL_SALES);
      setWaste(INITIAL_WASTE);
      setCampaigns(INITIAL_CAMPAIGNS);
      setAiRecommendations([]);
      showToast('Demo data restored successfully.');
    }
  };

  // ==========================================
  // GEMINI AI INTEGRATION (with Deterministic Fallback)
  // ==========================================

  const fetchGeminiRecommendations = async () => {
    setIsAiLoading(true);
    setAiError(null);

    // Filter strictly ELIGIBLE inventory to respect food-safety guardrails
    const eligibleBatches = classifiedBatches
      .filter(c => c.isEligibleForSale && (c.risk === 'APPROACHING_DATE' || c.risk === 'FRESH'))
      .map(c => ({
        batchId: c.batch.id,
        productName: c.batch.productName,
        category: c.batch.category,
        quantity: c.batch.quantity,
        unit: c.batch.unit,
        cost: c.batch.purchaseCostPerUnit,
        sellingPrice: c.batch.sellingPricePerUnit,
        expiryDate: c.batch.expiryDate,
        daysRemaining: c.daysRemaining,
        risk: c.risk,
      }));

    if (eligibleBatches.length === 0) {
      setIsAiLoading(false);
      setAiRecommendations([]);
      showToast('No eligible inventory items require AI recommendation at this time.');
      return;
    }

    const systemPrompt = `You are FreshSave AI, an expert commercial food waste reduction consultant for small local businesses.
Your goal is to prevent food waste, protect customer food safety, and maximize revenue recovery through smart discounting and inventory actions.
CRITICAL SAFETY RULE: Never suggest discounting or selling expired, uninspected, or unsafe food. Only provide suggestions for the provided eligible batches.
Always return structured JSON strictly following the schema.`;

    const userPrompt = `Analyze the following inventory batches for a "${profile.businessType}":
${JSON.stringify(eligibleBatches, null, 2)}

Provide up to 4 concrete, actionable inventory recommendations.
Return a valid JSON array of objects with these keys:
- "batchId": string (must match provided batchId)
- "productName": string
- "recommendationType": one of ["PRICE_DROP", "BUNDLE_SALE", "PRODUCTION_CUT", "PRIORITIZE_SHELF", "MANUAL_INSPECTION"]
- "title": short punchy title
- "explanation": concise business reason (1-2 sentences)
- "supportingObservations": facts observed from price, margin, quantity, and days remaining
- "suggestedAction": clear step for the owner
- "suggestedDiscountPercent": number (0 to 60)
- "assumptions": any caveat or assumption made
- "requiresHumanReview": boolean (true)`;

    const payload = {
      contents: [{ parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        responseMimeType: 'application/json',
      },
    };

    const apiKey = ''; // Canvas environment automatically populates Gemini keys at runtime
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;

    let parsedResult: any = null;

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`API HTTP status ${response.status}`);
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        parsedResult = JSON.parse(rawText);
      }
    } catch (err: any) {
      console.warn('Live Gemini call failed or unavailable. Activating deterministic fallback:', err);
      setAiError('Live Gemini AI unavailable. Displaying deterministic heuristic advice.');
    }

    // Process output or build deterministic fallback
    if (parsedResult && Array.isArray(parsedResult)) {
      const validated: AIRecommendation[] = parsedResult.map((item, index) => ({
        id: `rec-ai-${Date.now()}-${index}`,
        batchId: item.batchId || eligibleBatches[0].batchId,
        productName: item.productName || 'Batch Item',
        recommendationType: item.recommendationType || 'PRICE_DROP',
        title: item.title || 'Recommended Action',
        explanation: item.explanation || 'Analyzed from current shelf shelf life and volume.',
        supportingObservations: item.supportingObservations || 'Approaching safe date threshold.',
        suggestedAction: item.suggestedAction || 'Review pricing or feature on storefront.',
        suggestedDiscountPercent: item.suggestedDiscountPercent || 25,
        assumptions: item.assumptions || 'Assumes standard consumer demand velocity.',
        requiresHumanReview: true,
        createdAt: new Date().toLocaleDateString(),
      }));
      setAiRecommendations(validated);
      showToast('AI Recommendations generated via Gemini.');
    } else {
      // Robust deterministic fallback
      const fallbackRecs: AIRecommendation[] = atRiskBatches.map((item, idx) => ({
        id: `rec-fallback-${Date.now()}-${idx}`,
        batchId: item.batch.id,
        productName: item.batch.productName,
        recommendationType: 'PRICE_DROP',
        title: `Priority Rescue: ${item.batch.productName}`,
        explanation: `This product has ${item.daysRemaining <= 0 ? 'reached its final day' : `${item.daysRemaining} day remaining`} with ${item.batch.quantity} ${item.batch.unit} in stock.`,
        supportingObservations: `Purchased at ${profile.currency}${item.batch.purchaseCostPerUnit}, currently listed at ${profile.currency}${item.batch.sellingPricePerUnit}. Unsold stock risks 100% loss.`,
        suggestedAction: `Launch a flash discount campaign of 25% - 35% before end of today's business hours.`,
        suggestedDiscountPercent: 30,
        assumptions: 'Heuristic calculation based on remaining shelf life and cost-margin buffer.',
        requiresHumanReview: true,
        createdAt: new Date().toLocaleDateString(),
      }));

      setAiRecommendations(fallbackRecs);
      showToast('Generated deterministic heuristic recommendations.');
    }

    setIsAiLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#FBFBFA] text-[#1C201D] font-sans flex flex-col antialiased selection:bg-[#E2F0D9]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-[#0F3923] text-white text-sm px-4 py-3 rounded-xl shadow-2xl flex items-center space-x-2 border border-emerald-800 animate-fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-200/80 px-4 lg:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 -ml-2 rounded-lg text-gray-600 hover:text-gray-900 lg:hidden"
            aria-label="Toggle navigation"
          >
            <Layers className="w-5 h-5" />
          </button>
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#14532D] to-[#047857] flex items-center justify-center text-white font-bold shadow-sm">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight text-[#14532D]">FreshSave</span>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  AI MVP
                </span>
              </div>
              <p className="text-xs text-gray-500 font-medium hidden sm:block">
                Save Food. Save Money. Make Every Item Count.
              </p>
            </div>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center space-x-3">
          <div className="hidden md:flex flex-col text-right">
            <span className="text-xs font-semibold text-gray-800">{profile.businessName}</span>
            <span className="text-[11px] text-gray-500">{profile.businessType}</span>
          </div>

          <button 
            onClick={handleResetDemoData}
            title="Reset to default hackathon demo dataset"
            className="px-2.5 py-1.5 text-xs font-medium bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors flex items-center space-x-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset Demo Data</span>
          </button>

          <button
            onClick={() => setShowAddInventoryModal(true)}
            className="px-3 py-1.5 text-xs font-semibold bg-[#14532D] hover:bg-[#0f3d21] text-white rounded-lg shadow-sm flex items-center space-x-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Batch</span>
          </button>
        </div>
      </header>

      {/* Main Layout Container */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto px-4 lg:px-8 py-6 gap-6">
        {/* Navigation Sidebar (Desktop) */}
        <aside className="w-60 shrink-0 hidden lg:block space-y-1">
          <div className="pb-3 px-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
            Operations
          </div>
          <SidebarNavButton 
            active={activeTab === 'overview'} 
            onClick={() => setActiveTab('overview')} 
            icon={<BarChart3 className="w-4 h-4" />}
            label="Overview" 
            badge={atRiskBatches.length > 0 ? `${atRiskBatches.length}` : undefined}
            badgeColor="bg-amber-100 text-amber-800"
          />
          <SidebarNavButton 
            active={activeTab === 'inventory'} 
            onClick={() => setActiveTab('inventory')} 
            icon={<Package className="w-4 h-4" />}
            label="Inventory" 
            badge={`${activeBatches.length}`}
          />
          <SidebarNavButton 
            active={activeTab === 'recommendations'} 
            onClick={() => setActiveTab('recommendations')} 
            icon={<Sparkles className="w-4 h-4" />}
            label="Smart AI Advisor" 
            badge="AI"
            badgeColor="bg-emerald-100 text-emerald-800 font-bold"
          />
          <SidebarNavButton 
            active={activeTab === 'campaigns'} 
            onClick={() => setActiveTab('campaigns')} 
            icon={<Tag className="w-4 h-4" />}
            label="Rescue Offers" 
            badge={campaigns.filter(c => c.status === 'approved').length > 0 ? `${campaigns.filter(c => c.status === 'approved').length}` : undefined}
          />
          <SidebarNavButton 
            active={activeTab === 'waste'} 
            onClick={() => setActiveTab('waste')} 
            icon={<Trash2 className="w-4 h-4" />}
            label="Waste Tracker" 
            badge={expiredBatches.length > 0 ? `! ${expiredBatches.length}` : undefined}
            badgeColor="bg-rose-100 text-rose-800 font-bold"
          />

          <div className="pt-6 pb-3 px-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
            Analysis & Configuration
          </div>
          <SidebarNavButton 
            active={activeTab === 'reports'} 
            onClick={() => setActiveTab('reports')} 
            icon={<FileText className="w-4 h-4" />}
            label="Reports & Analytics" 
          />
          <SidebarNavButton 
            active={activeTab === 'settings'} 
            onClick={() => setActiveTab('settings')} 
            icon={<Settings className="w-4 h-4" />}
            label="Business Settings" 
          />

          {/* Food Safety Policy Card */}
          <div className="mt-8 p-3.5 bg-emerald-50/70 border border-emerald-200/60 rounded-xl text-xs space-y-2">
            <div className="flex items-center space-x-1.5 font-semibold text-emerald-900">
              <ShieldAlert className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Safety Guardrail</span>
            </div>
            <p className="text-emerald-800/90 leading-relaxed text-[11px]">
              Deterministic safety checks run before any promotional or pricing logic. Expired or uninspected stock is automatically locked out of campaigns.
            </p>
          </div>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
            <div className="relative w-64 bg-white p-5 flex flex-col space-y-2 z-10 shadow-2xl">
              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <span className="font-bold text-gray-800">Menu</span>
                <button onClick={() => setMobileMenuOpen(false)} className="p-1 rounded-md text-gray-500">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <MobileNavButton 
                active={activeTab === 'overview'} 
                onClick={() => { setActiveTab('overview'); setMobileMenuOpen(false); }} 
                label="Overview" 
              />
              <MobileNavButton 
                active={activeTab === 'inventory'} 
                onClick={() => { setActiveTab('inventory'); setMobileMenuOpen(false); }} 
                label="Inventory Management" 
              />
              <MobileNavButton 
                active={activeTab === 'recommendations'} 
                onClick={() => { setActiveTab('recommendations'); setMobileMenuOpen(false); }} 
                label="Smart AI Advisor" 
              />
              <MobileNavButton 
                active={activeTab === 'campaigns'} 
                onClick={() => { setActiveTab('campaigns'); setMobileMenuOpen(false); }} 
                label="Discount Campaigns" 
              />
              <MobileNavButton 
                active={activeTab === 'waste'} 
                onClick={() => { setActiveTab('waste'); setMobileMenuOpen(false); }} 
                label="Waste Tracker" 
              />
              <MobileNavButton 
                active={activeTab === 'reports'} 
                onClick={() => { setActiveTab('reports'); setMobileMenuOpen(false); }} 
                label="Reports & Analytics" 
              />
              <MobileNavButton 
                active={activeTab === 'settings'} 
                onClick={() => { setActiveTab('settings'); setMobileMenuOpen(false); }} 
                label="Business Settings" 
              />
            </div>
          </div>
        )}

        {/* Central Workspace Content */}
        <main className="flex-1 min-w-0">
          {activeTab === 'overview' && (
            <OverviewSection 
              profile={profile}
              batches={batches}
              sales={sales}
              waste={waste}
              campaigns={campaigns}
              atRiskBatches={atRiskBatches}
              expiredBatches={expiredBatches}
              estimatedAtRiskValue={estimatedAtRiskValue}
              totalRecordedWasteCost={totalRecordedWasteCost}
              rescueSalesRevenue={rescueSalesRevenue}
              rescueCostRecovered={rescueCostRecovered}
              onNavigate={setActiveTab}
              onRecordSale={(batch) => {
                setSelectedBatchForAction(batch);
                setShowRecordSaleModal(true);
              }}
              onRecordWaste={(batch) => {
                setSelectedBatchForAction(batch);
                setShowRecordWasteModal(true);
              }}
              onCreateCampaign={(batch) => {
                setSelectedBatchForAction(batch);
                setShowCreateCampaignModal(true);
              }}
            />
          )}

          {activeTab === 'inventory' && (
            <InventorySection 
              batches={batches}
              currency={profile.currency}
              warningDaysThreshold={profile.warningDaysThreshold}
              onAddBatch={() => setShowAddInventoryModal(true)}
              onToggleArchive={(batchId) => {
                setBatches(prev => prev.map(b => b.id === batchId ? { ...b, isArchived: !b.isArchived } : b));
                showToast('Batch status updated.');
              }}
              onToggleUnsafe={(batchId) => {
                setBatches(prev => prev.map(b => b.id === batchId ? { ...b, isUnsafe: !b.isUnsafe } : b));
                showToast('Safety inspection status updated.');
              }}
              onDeleteBatch={(batchId) => {
                if (window.confirm('Are you sure you want to delete this batch record?')) {
                  setBatches(prev => prev.filter(b => b.id !== batchId));
                  showToast('Batch removed.');
                }
              }}
              onRecordSale={(batch) => {
                setSelectedBatchForAction(batch);
                setShowRecordSaleModal(true);
              }}
              onRecordWaste={(batch) => {
                setSelectedBatchForAction(batch);
                setShowRecordWasteModal(true);
              }}
              onCreateCampaign={(batch) => {
                setSelectedBatchForAction(batch);
                setShowCreateCampaignModal(true);
              }}
            />
          )}

          {activeTab === 'recommendations' && (
            <SmartRecommendationsSection 
              profile={profile}
              atRiskBatches={atRiskBatches}
              aiRecommendations={aiRecommendations}
              isAiLoading={isAiLoading}
              aiError={aiError}
              onFetchAI={fetchGeminiRecommendations}
              onCreateCampaignFromRec={(batchId, discount) => {
                const targetBatch = batches.find(b => b.id === batchId);
                if (targetBatch) {
                  setSelectedBatchForAction(targetBatch);
                  setShowCreateCampaignModal(true);
                }
              }}
            />
          )}

          {activeTab === 'campaigns' && (
            <DiscountCampaignSection 
              campaigns={campaigns}
              batches={batches}
              currency={profile.currency}
              onLaunchNew={() => setShowCreateCampaignModal(true)}
              onUpdateStatus={(campId, status) => {
                setCampaigns(prev => prev.map(c => c.id === campId ? { ...c, status } : c));
                showToast(`Campaign status updated to ${status}.`);
              }}
              onDeleteCampaign={(campId) => {
                setCampaigns(prev => prev.filter(c => c.id !== campId));
                showToast('Campaign deleted.');
              }}
            />
          )}

          {activeTab === 'waste' && (
            <WasteTrackerSection 
              waste={waste}
              batches={batches}
              currency={profile.currency}
              expiredBatches={expiredBatches}
              onRecordWasteDirect={() => {
                setSelectedBatchForAction(null);
                setShowRecordWasteModal(true);
              }}
              onQuickDisposeExpired={(batch) => {
                setSelectedBatchForAction(batch);
                setShowRecordWasteModal(true);
              }}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsAnalyticsSection 
              profile={profile}
              batches={batches}
              sales={sales}
              waste={waste}
              campaigns={campaigns}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsSection 
              profile={profile}
              batches={batches}
              sales={sales}
              waste={waste}
              campaigns={campaigns}
              onSaveProfile={(updated) => {
                setProfile(updated);
                showToast('Business configuration saved.');
              }}
              onRestoreBackup={(importedData) => {
                if (importedData.profile) setProfile(importedData.profile);
                if (importedData.batches) setBatches(importedData.batches);
                if (importedData.sales) setSales(importedData.sales);
                if (importedData.waste) setWaste(importedData.waste);
                if (importedData.campaigns) setCampaigns(importedData.campaigns);
                showToast('Backup data successfully restored.');
              }}
            />
          )}
        </main>
      </div>

      {/* ==========================================
          MODALS
      ========================================== */}

      {/* 1. Add Batch Modal */}
      {showAddInventoryModal && (
        <AddBatchModal 
          currency={profile.currency}
          onClose={() => setShowAddInventoryModal(false)}
          onSave={(newBatch) => {
            setBatches(prev => [newBatch, ...prev]);
            setShowAddInventoryModal(false);
            showToast(`Added batch "${newBatch.productName}".`);
          }}
        />
      )}

      {/* 2. Record Sale Modal */}
      {showRecordSaleModal && (
        <RecordSaleModal 
          batches={activeBatches}
          initialBatch={selectedBatchForAction}
          currency={profile.currency}
          onClose={() => setShowRecordSaleModal(false)}
          onSave={(saleRecord) => {
            // Deduct quantity from inventory
            setBatches(prev => prev.map(b => {
              if (b.id === saleRecord.batchId) {
                const nextQty = Math.max(0, b.quantity - saleRecord.quantitySold);
                return { ...b, quantity: nextQty };
              }
              return b;
            }));
            setSales(prev => [saleRecord, ...prev]);
            setShowRecordSaleModal(false);
            showToast(`Recorded sale of ${saleRecord.quantitySold} units.`);
          }}
        />
      )}

      {/* 3. Record Waste Modal */}
      {showRecordWasteModal && (
        <RecordWasteModal 
          batches={batches.filter(b => !b.isArchived && b.quantity > 0)}
          initialBatch={selectedBatchForAction}
          currency={profile.currency}
          onClose={() => setShowRecordWasteModal(false)}
          onSave={(wasteRecord) => {
            // Deduct quantity from inventory
            setBatches(prev => prev.map(b => {
              if (b.id === wasteRecord.batchId) {
                const nextQty = Math.max(0, b.quantity - wasteRecord.quantityWasted);
                return { ...b, quantity: nextQty };
              }
              return b;
            }));
            setWaste(prev => [wasteRecord, ...prev]);
            setShowRecordWasteModal(false);
            showToast(`Recorded ${wasteRecord.quantityWasted} units in Waste Tracker.`);
          }}
        />
      )}

      {/* 4. Create Rescue Campaign Modal */}
      {showCreateCampaignModal && (
        <CreateCampaignModal 
          eligibleBatches={atRiskBatches.map(a => a.batch)}
          initialBatch={selectedBatchForAction && classifyBatchRisk(selectedBatchForAction).isEligibleForSale ? selectedBatchForAction : null}
          profile={profile}
          onClose={() => setShowCreateCampaignModal(false)}
          onSave={(campaign) => {
            setCampaigns(prev => [campaign, ...prev]);
            setShowCreateCampaignModal(false);
            setActiveTab('campaigns');
            showToast('Rescue offer created and ready to preview/share!');
          }}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-6 mt-12 text-center text-xs text-gray-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-gray-800">FreshSave AI</span>
            <span>—</span>
            <span>Save Food. Save Money.</span>
          </div>
          <div className="text-gray-600 font-medium">
            Built with ambition by <span className="text-[#14532D] font-semibold">Prajot Kamble</span>
          </div>
          <div className="text-[11px] text-gray-400">
            Hackathon Edition • Entrepreneurship & Local Business
          </div>
        </div>
      </footer>
    </div>
  );
}

// ==========================================
// SUB-COMPONENTS & VIEWS
// ==========================================

function SidebarNavButton({ 
  active, 
  onClick, 
  icon, 
  label, 
  badge,
  badgeColor = "bg-gray-100 text-gray-600"
}: { 
  active: boolean; 
  onClick: () => void; 
  icon: React.ReactNode; 
  label: string; 
  badge?: string;
  badgeColor?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
        active 
          ? 'bg-[#14532D] text-white shadow-sm' 
          : 'text-gray-700 hover:bg-gray-100/80 hover:text-gray-900'
      }`}
    >
      <div className="flex items-center space-x-2.5">
        <span className={active ? 'text-white' : 'text-gray-500'}>{icon}</span>
        <span>{label}</span>
      </div>
      {badge && (
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : badgeColor}`}>
          {badge}
        </span>
      )}
    </button>
  );
}

function MobileNavButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
        active ? 'bg-[#14532D] text-white' : 'text-gray-700 hover:bg-gray-100'
      }`}
    >
      {label}
    </button>
  );
}

// ==========================================
// 1. OVERVIEW SECTION
// ==========================================

function OverviewSection({
  profile,
  batches,
  sales,
  waste,
  campaigns,
  atRiskBatches,
  expiredBatches,
  estimatedAtRiskValue,
  totalRecordedWasteCost,
  rescueSalesRevenue,
  rescueCostRecovered,
  onNavigate,
  onRecordSale,
  onRecordWaste,
  onCreateCampaign,
}: {
  profile: BusinessProfile;
  batches: InventoryBatch[];
  sales: SaleTransaction[];
  waste: WasteRecord[];
  campaigns: DiscountCampaign[];
  atRiskBatches: any[];
  expiredBatches: any[];
  estimatedAtRiskValue: number;
  totalRecordedWasteCost: number;
  rescueSalesRevenue: number;
  rescueCostRecovered: number;
  onNavigate: (tab: any) => void;
  onRecordSale: (b: InventoryBatch) => void;
  onRecordWaste: (b: InventoryBatch) => void;
  onCreateCampaign: (b: InventoryBatch) => void;
}) {
  // Chart calculation for inventory risk breakdown
  const riskChartData = useMemo(() => {
    let freshCount = 0;
    let approachingCount = 0;
    let expiredCount = 0;

    batches.forEach(b => {
      if (b.isArchived || b.quantity <= 0) return;
      const c = classifyBatchRisk(b, profile.warningDaysThreshold);
      if (c.risk === 'FRESH') freshCount++;
      else if (c.risk === 'APPROACHING_DATE') approachingCount++;
      else expiredCount++;
    });

    return [
      { name: 'Fresh', count: freshCount, fill: '#10B981' },
      { name: 'Approaching Expiry', count: approachingCount, fill: '#F59E0B' },
      { name: 'Expired/Unsafe', count: expiredCount, fill: '#EF4444' },
    ];
  }, [batches, profile.warningDaysThreshold]);

  return (
    <div className="space-y-6">
      {/* Top Welcome / Pitch Card */}
      <div className="bg-gradient-to-r from-[#14532D] via-[#0F3923] to-[#064E3B] text-white rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5 max-w-xl">
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-white/10 text-emerald-200 text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Smart Preventive Waste Reduction</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            Prevent avoidable waste before it happens.
          </h1>
          <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
            FreshSave AI monitors approaching use-by deadlines, calculates safe margin-preserving rescue discounts, and drafts verified promotional copy in English, Hindi, and Marathi.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button 
            onClick={() => onNavigate('recommendations')}
            className="px-4 py-2.5 rounded-xl bg-white text-[#14532D] font-semibold text-xs hover:bg-emerald-50 transition-all shadow-sm flex items-center space-x-1.5"
          >
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>Generate AI Advice</span>
          </button>
          <button 
            onClick={() => onNavigate('campaigns')}
            className="px-4 py-2.5 rounded-xl bg-emerald-800/80 hover:bg-emerald-800 text-white font-semibold text-xs border border-emerald-700/60 transition-all flex items-center space-x-1.5"
          >
            <Tag className="w-4 h-4" />
            <span>Rescue Offers</span>
          </button>
        </div>
      </div>

      {/* KPI 4-Card Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Items Requiring Attention */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">At-Risk Batches</span>
              <AlertTriangle className={`w-4 h-4 ${atRiskBatches.length > 0 ? 'text-amber-500' : 'text-gray-400'}`} />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {atRiskBatches.length} <span className="text-xs font-normal text-gray-500">batches</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
            <span className="text-amber-700 font-medium">Within {profile.warningDaysThreshold} days of expiry</span>
            <button onClick={() => onNavigate('inventory')} className="text-[#14532D] hover:underline font-semibold">View</button>
          </div>
        </div>

        {/* Card 2: Eligible At-Risk Value */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">At-Risk Shelf Value</span>
              <DollarSign className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {profile.currency}{estimatedAtRiskValue.toLocaleString()}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
            <span className="text-gray-500">Potential loss if unsold</span>
            <span className="text-emerald-700 font-medium">Eligible for rescue</span>
          </div>
        </div>

        {/* Card 3: Rescue Sales Revenue */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Rescue Revenue</span>
              <TrendingDown className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-emerald-700">
              {profile.currency}{rescueSalesRevenue.toLocaleString()}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
            <span className="text-gray-500">Cost recovered:</span>
            <span className="font-semibold text-gray-800">{profile.currency}{rescueCostRecovered.toLocaleString()}</span>
          </div>
        </div>

        {/* Card 4: Recorded Waste Cost */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Recorded Waste</span>
              <Trash2 className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-2xl font-bold text-rose-600">
              {profile.currency}{totalRecordedWasteCost.toLocaleString()}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
            <span className="text-gray-500">{waste.length} disposals logged</span>
            <button onClick={() => onNavigate('waste')} className="text-rose-700 hover:underline font-semibold">Audit</button>
          </div>
        </div>
      </div>

      {/* Main Grid: Priority Action Queue & Risk Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Urgent Priority Action Queue */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200/80 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h2 className="text-base font-bold text-gray-900 flex items-center space-x-2">
                <span>Priority Action Queue</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">
                  {atRiskBatches.length + expiredBatches.length} items
                </span>
              </h2>
              <p className="text-xs text-gray-500">
                Sorted by expiration urgency. Expirations require disposal; approaching stock requires discount rescue.
              </p>
            </div>
            <button 
              onClick={() => onNavigate('inventory')}
              className="text-xs font-semibold text-[#14532D] hover:underline flex items-center space-x-1"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {atRiskBatches.length === 0 && expiredBatches.length === 0 ? (
              <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-semibold text-gray-700">All inventory fresh and in safe range!</p>
                <p className="text-xs text-gray-500 mt-1">No batches currently approaching expiry or past date.</p>
              </div>
            ) : (
              <>
                {/* Expired Batches Warning (Immediate disposal action required) */}
                {expiredBatches.map(({ batch, reason }) => (
                  <div key={batch.id} className="p-4 rounded-xl border border-rose-200 bg-rose-50/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-200 text-rose-900">
                          EXPIRED / INELIGIBLE
                        </span>
                        <span className="font-semibold text-sm text-gray-900">{batch.productName}</span>
                        <span className="text-xs text-gray-500">({batch.batchNumber})</span>
                      </div>
                      <p className="text-xs text-rose-800 font-medium">{reason}</p>
                      <p className="text-[11px] text-gray-500">
                        Remaining: {batch.quantity} {batch.unit} • Purchase cost: {profile.currency}{batch.purchaseCostPerUnit * batch.quantity}
                      </p>
                    </div>
                    <button
                      onClick={() => onRecordWaste(batch)}
                      className="px-3.5 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-all shrink-0 shadow-sm"
                    >
                      Log Disposal
                    </button>
                  </div>
                ))}

                {/* Approaching Expiry (Eligible for Rescue Offer) */}
                {atRiskBatches.map(({ batch, reason, daysRemaining }) => (
                  <div key={batch.id} className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-200 text-amber-900">
                          {daysRemaining === 0 ? 'TODAY' : `${daysRemaining}D LEFT`}
                        </span>
                        <span className="font-semibold text-sm text-gray-900">{batch.productName}</span>
                        <span className="text-xs text-gray-500">({batch.category})</span>
                      </div>
                      <p className="text-xs text-amber-900">{reason}</p>
                      <div className="flex items-center space-x-3 text-[11px] text-gray-600">
                        <span>Stock: <strong>{batch.quantity} {batch.unit}</strong></span>
                        <span>Price: <strong>{profile.currency}{batch.sellingPricePerUnit}</strong></span>
                        <span>Cost: <strong>{profile.currency}{batch.purchaseCostPerUnit}</strong></span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        onClick={() => onCreateCampaign(batch)}
                        className="px-3 py-1.5 text-xs font-semibold bg-[#14532D] hover:bg-[#0f3d21] text-white rounded-lg transition-all shadow-sm flex items-center space-x-1"
                      >
                        <Tag className="w-3.5 h-3.5" />
                        <span>Rescue Offer</span>
                      </button>
                      <button
                        onClick={() => onRecordSale(batch)}
                        className="px-2.5 py-1.5 text-xs font-medium bg-white hover:bg-gray-100 text-gray-800 border border-gray-300 rounded-lg transition-all"
                      >
                        Record Sale
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Right Column: Inventory Status Breakdown Chart */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-6 flex flex-col justify-between space-y-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">Inventory Risk Distribution</h2>
            <p className="text-xs text-gray-500 mt-0.5">Active batches categorized by food-safety shelf life status</p>
          </div>

          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskChartData} layout="vertical" margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F4F6" />
                <XAxis type="number" allowDecimals={false} stroke="#9CA3AF" fontSize={11} />
                <YAxis dataKey="name" type="category" stroke="#4B5563" fontSize={11} width={110} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '12px' }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {riskChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="p-3 bg-gray-50 rounded-xl border border-gray-200/70 text-xs space-y-1.5">
            <div className="flex justify-between items-center text-gray-600">
              <span>Warning Threshold:</span>
              <span className="font-semibold text-gray-900">{profile.warningDaysThreshold} days before use-by</span>
            </div>
            <div className="flex justify-between items-center text-gray-600">
              <span>Target Min Margin:</span>
              <span className="font-semibold text-gray-900">{profile.minAcceptableMarginPercent}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 2. INVENTORY SECTION
// ==========================================

function InventorySection({
  batches,
  currency,
  warningDaysThreshold,
  onAddBatch,
  onToggleArchive,
  onToggleUnsafe,
  onDeleteBatch,
  onRecordSale,
  onRecordWaste,
  onCreateCampaign,
}: {
  batches: InventoryBatch[];
  currency: string;
  warningDaysThreshold: number;
  onAddBatch: () => void;
  onToggleArchive: (id: string) => void;
  onToggleUnsafe: (id: string) => void;
  onDeleteBatch: (id: string) => void;
  onRecordSale: (b: InventoryBatch) => void;
  onRecordWaste: (b: InventoryBatch) => void;
  onCreateCampaign: (b: InventoryBatch) => void;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [riskFilter, setRiskFilter] = useState('ALL');

  const categories = useMemo(() => {
    const set = new Set<string>();
    batches.forEach(b => set.add(b.category));
    return Array.from(set);
  }, [batches]);

  const filteredBatches = useMemo(() => {
    return batches.filter(batch => {
      if (batch.isArchived) return false;
      const matchesSearch = 
        batch.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        batch.batchNumber.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = categoryFilter === 'ALL' || batch.category === categoryFilter;

      const classification = classifyBatchRisk(batch, warningDaysThreshold);
      const matchesRisk = riskFilter === 'ALL' || classification.risk === riskFilter;

      return matchesSearch && matchesCategory && matchesRisk;
    });
  }, [batches, searchTerm, categoryFilter, riskFilter, warningDaysThreshold]);

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Inventory Management</h1>
          <p className="text-xs text-gray-500">
            Track individual product batches, dates, safety thresholds, and unit costs.
          </p>
        </div>
        <button
          onClick={onAddBatch}
          className="px-4 py-2 bg-[#14532D] hover:bg-[#0f3d21] text-white text-xs font-semibold rounded-xl shadow-sm flex items-center justify-center space-x-1.5 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Batch</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search by product name or batch ID..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#14532D]/20 focus:border-[#14532D]"
          />
        </div>

        <div className="flex flex-wrap w-full md:w-auto items-center gap-2">
          <div className="flex items-center space-x-1 text-xs text-gray-500">
            <Filter className="w-3.5 h-3.5" />
            <span>Category:</span>
          </div>
          <select 
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#14532D]"
          >
            <option value="ALL">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <select 
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#14532D]"
          >
            <option value="ALL">All Risk Levels</option>
            <option value="FRESH">Fresh</option>
            <option value="APPROACHING_DATE">Approaching Expiry</option>
            <option value="EXPIRED">Expired</option>
            <option value="UNSAFE_OR_QUESTIONABLE">Flagged Unsafe</option>
          </select>
        </div>
      </div>

      {/* Batches Table Card */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/70 border-b border-gray-200 text-gray-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Batch / Product</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Stock</th>
                <th className="py-3 px-4">Pricing</th>
                <th className="py-3 px-4">Expiry / Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400">
                    No inventory batches match your selected criteria.
                  </td>
                </tr>
              ) : (
                filteredBatches.map(batch => {
                  const classification = classifyBatchRisk(batch, warningDaysThreshold);
                  const isLowStock = batch.quantity <= 5;

                  return (
                    <tr key={batch.id} className="hover:bg-gray-50/70 transition-colors">
                      {/* Product & Batch ID */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-900">{batch.productName}</div>
                        <div className="text-[11px] text-gray-500 font-mono">
                          Batch: {batch.batchNumber} • Recd: {batch.dateReceived}
                        </div>
                        {batch.storageNotes && (
                          <div className="text-[10px] text-gray-400 italic">
                            Storage: {batch.storageNotes}
                          </div>
                        )}
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4 text-gray-600">
                        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[11px]">
                          {batch.category}
                        </span>
                      </td>

                      {/* Stock Quantity */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-900">
                          {batch.quantity} <span className="text-[11px] text-gray-500">{batch.unit}</span>
                        </div>
                        <div className="text-[10px] text-gray-400">
                          Initial: {batch.initialQuantity} {batch.unit}
                        </div>
                      </td>

                      {/* Cost & Sell Price */}
                      <td className="py-3.5 px-4">
                        <div className="text-gray-900 font-medium">
                          Sell: {currency}{batch.sellingPricePerUnit}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          Cost: {currency}{batch.purchaseCostPerUnit}
                        </div>
                      </td>

                      {/* Expiry & Safety Status */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-1.5 mb-1">
                          {classification.risk === 'FRESH' && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              FRESH ({classification.daysRemaining}d)
                            </span>
                          )}
                          {classification.risk === 'APPROACHING_DATE' && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                              ATTENTION ({classification.daysRemaining === 0 ? 'TODAY' : `${classification.daysRemaining}d left`})
                            </span>
                          )}
                          {classification.risk === 'EXPIRED' && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                              EXPIRED
                            </span>
                          )}
                          {classification.risk === 'UNSAFE_OR_QUESTIONABLE' && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-200 text-red-900">
                              UNSAFE
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          Use by: {batch.expiryDate || 'Not specified'}
                        </div>
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          {classification.isEligibleForSale && batch.quantity > 0 && (
                            <button
                              onClick={() => onCreateCampaign(batch)}
                              title="Create promotional rescue offer"
                              className="p-1.5 rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors"
                            >
                              <Tag className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {batch.quantity > 0 && (
                            <button
                              onClick={() => onRecordSale(batch)}
                              title="Record a sale"
                              className="p-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {batch.quantity > 0 && (
                            <button
                              onClick={() => onRecordWaste(batch)}
                              title="Record spoilage / disposal"
                              className="p-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => onToggleUnsafe(batch.id)}
                            title={batch.isUnsafe ? 'Mark batch safe' : 'Flag batch as unsafe'}
                            className={`p-1.5 rounded-lg transition-colors ${batch.isUnsafe ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                          >
                            <ShieldAlert className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onDeleteBatch(batch.id)}
                            title="Delete record"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 3. SMART RECOMMENDATIONS SECTION (AI)
// ==========================================

function SmartRecommendationsSection({
  profile,
  atRiskBatches,
  aiRecommendations,
  isAiLoading,
  aiError,
  onFetchAI,
  onCreateCampaignFromRec,
}: {
  profile: BusinessProfile;
  atRiskBatches: any[];
  aiRecommendations: AIRecommendation[];
  isAiLoading: boolean;
  aiError: string | null;
  onFetchAI: () => void;
  onCreateCampaignFromRec: (batchId: string, discount?: number) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
            <span>Gemini AI Smart Advisor</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
              gemini-3-flash-preview
            </span>
          </h1>
          <p className="text-xs text-gray-500">
            Synthesizes current eligible inventory, shelf dates, and cost structures into grounded commercial recommendations.
          </p>
        </div>
        <button
          onClick={onFetchAI}
          disabled={isAiLoading}
          className="px-4 py-2.5 bg-[#14532D] hover:bg-[#0f3d21] disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-sm flex items-center justify-center space-x-2 transition-all"
        >
          <Sparkles className={`w-4 h-4 ${isAiLoading ? 'animate-spin' : 'text-emerald-300'}`} />
          <span>{isAiLoading ? 'Analyzing Inventory...' : 'Run Gemini Advisory'}</span>
        </button>
      </div>

      {/* Safety Notice & Status */}
      {aiError && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center space-x-2">
          <Info className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{aiError}</span>
        </div>
      )}

      {/* Recommendations Grid */}
      {aiRecommendations.length === 0 && !isAiLoading ? (
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-800 flex items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6 text-emerald-600" />
          </div>
          <h3 className="text-base font-bold text-gray-900">No active AI recommendations generated yet</h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            Click "Run Gemini Advisory" to send eligible at-risk stock batches to Gemini for safe promotional discounting proposals and stock action plans.
          </p>
          <button
            onClick={onFetchAI}
            className="mt-2 px-4 py-2 bg-[#14532D] text-white text-xs font-semibold rounded-xl hover:bg-[#0f3d21] transition-all"
          >
            Analyze {atRiskBatches.length} Eligible Batches
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {aiRecommendations.map(rec => (
            <div key={rec.id} className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                    {rec.recommendationType.replace('_', ' ')}
                  </span>
                  <span className="text-[11px] text-gray-400">{rec.createdAt}</span>
                </div>
                <h3 className="text-sm font-bold text-gray-900">{rec.title}</h3>
                <p className="text-xs text-gray-700 leading-relaxed">{rec.explanation}</p>
                
                <div className="p-3 bg-gray-50 rounded-xl space-y-1.5 text-[11px] text-gray-600 border border-gray-100">
                  <div className="font-semibold text-gray-800 flex items-center space-x-1">
                    <Info className="w-3 h-3 text-emerald-700" />
                    <span>Supporting Observations:</span>
                  </div>
                  <p className="text-gray-600">{rec.supportingObservations}</p>
                  <div className="pt-1 text-gray-500 italic">
                    Assumptions: {rec.assumptions}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-500 font-medium">
                  {rec.suggestedDiscountPercent ? `Suggested: ${rec.suggestedDiscountPercent}% off` : 'Action Recommended'}
                </span>
                <button
                  onClick={() => onCreateCampaignFromRec(rec.batchId, rec.suggestedDiscountPercent)}
                  className="px-3 py-1.5 bg-[#14532D] hover:bg-[#0f3d21] text-white text-xs font-semibold rounded-lg shadow-sm flex items-center space-x-1 transition-all"
                >
                  <Tag className="w-3.5 h-3.5" />
                  <span>Launch Rescue Offer</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==========================================
// 4. DISCOUNT CAMPAIGNS SECTION
// ==========================================

function DiscountCampaignSection({
  campaigns,
  batches,
  currency,
  onLaunchNew,
  onUpdateStatus,
  onDeleteCampaign,
}: {
  campaigns: DiscountCampaign[];
  batches: InventoryBatch[];
  currency: string;
  onLaunchNew: () => void;
  onUpdateStatus: (id: string, status: any) => void;
  onDeleteCampaign: (id: string) => void;
}) {
  const [selectedCampaign, setSelectedCampaign] = useState<DiscountCampaign | null>(campaigns[0] || null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    alert(`${label} copied to clipboard!`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Rescue Offer Campaigns</h1>
          <p className="text-xs text-gray-500">
            Customer-facing discount promotions formatted for WhatsApp broadcasts, Instagram captions, and store flyers.
          </p>
        </div>
        <button
          onClick={onLaunchNew}
          className="px-4 py-2 bg-[#14532D] hover:bg-[#0f3d21] text-white text-xs font-semibold rounded-xl shadow-sm flex items-center justify-center space-x-1.5 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Create Rescue Offer</span>
        </button>
      </div>

      {campaigns.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-12 text-center space-y-3">
          <Tag className="w-10 h-10 text-gray-300 mx-auto" />
          <h3 className="text-base font-bold text-gray-900">No campaigns created yet</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            Create your first Rescue Offer to sell eligible approaching inventory before use-by limits.
          </p>
          <button
            onClick={onLaunchNew}
            className="px-4 py-2 bg-[#14532D] text-white text-xs font-semibold rounded-xl"
          >
            Create Offer Now
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Campaign Selector List */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">Active Offers</h2>
            {campaigns.map(camp => (
              <div
                key={camp.id}
                onClick={() => setSelectedCampaign(camp)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  selectedCampaign?.id === camp.id
                    ? 'border-[#14532D] bg-emerald-50/40 shadow-sm ring-1 ring-[#14532D]'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    camp.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {camp.status}
                  </span>
                  <span className="text-xs font-bold text-emerald-800">
                    {camp.discountPercent}% OFF
                  </span>
                </div>
                <div className="font-semibold text-sm text-gray-900">{camp.productName}</div>
                <div className="text-xs text-gray-500 mt-1 flex items-center justify-between">
                  <span>Price: <strong className="text-gray-900">{currency}{camp.discountedPrice}</strong> <del className="text-gray-400 font-normal">{currency}{camp.originalPrice}</del></span>
                  <span>Margin: ~{camp.estimatedMarginPercent}%</span>
                </div>
              </div>
            ))}
          </div>

          {/* Campaign Detail / Preview & Copy */}
          {selectedCampaign && (
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200/80 shadow-sm p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-base font-bold text-gray-900">{selectedCampaign.headline}</h2>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                      {selectedCampaign.language.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Target: {selectedCampaign.quantityOffered} units • Tone: {selectedCampaign.tone}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  {selectedCampaign.status === 'draft' ? (
                    <button
                      onClick={() => onUpdateStatus(selectedCampaign.id, 'approved')}
                      className="px-3 py-1.5 bg-emerald-700 text-white text-xs font-semibold rounded-lg hover:bg-emerald-800"
                    >
                      Approve Offer
                    </button>
                  ) : (
                    <button
                      onClick={() => onUpdateStatus(selectedCampaign.id, 'completed')}
                      className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200"
                    >
                      Mark Completed
                    </button>
                  )}
                  <button
                    onClick={() => onDeleteCampaign(selectedCampaign.id)}
                    className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg"
                    title="Delete Campaign"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Copy Cards */}
              <div className="space-y-4">
                {/* 1. WhatsApp Copy */}
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200/70 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-gray-800 flex items-center space-x-1.5">
                      <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>WhatsApp Broadcast Copy</span>
                    </span>
                    <button
                      onClick={() => copyToClipboard(selectedCampaign.whatsappMessage, 'WhatsApp text')}
                      className="px-2.5 py-1 bg-white border border-gray-200 text-gray-700 rounded-md text-[11px] font-medium hover:bg-gray-100 flex items-center space-x-1"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copy for WhatsApp</span>
                    </button>
                  </div>
                  <p className="text-xs text-gray-700 bg-white p-3 rounded-lg border border-gray-100 whitespace-pre-wrap leading-relaxed">
                    {selectedCampaign.whatsappMessage}
                  </p>
                </div>

                {/* 2. Instagram Caption */}
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200/70 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-gray-800 flex items-center space-x-1.5">
                      <Share2 className="w-3.5 h-3.5 text-pink-600" />
                      <span>Instagram Social Caption</span>
                    </span>
                    <button
                      onClick={() => copyToClipboard(selectedCampaign.instagramCaption, 'Instagram caption')}
                      className="px-2.5 py-1 bg-white border border-gray-200 text-gray-700 rounded-md text-[11px] font-medium hover:bg-gray-100 flex items-center space-x-1"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copy Caption</span>
                    </button>
                  </div>
                  <p className="text-xs text-gray-700 bg-white p-3 rounded-lg border border-gray-100 whitespace-pre-wrap leading-relaxed">
                    {selectedCampaign.instagramCaption}
                  </p>
                </div>

                {/* 3. Poster Graphic Concept */}
                <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200/70 space-y-2">
                  <div className="text-xs font-bold text-emerald-900 flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Store Poster Graphic Directive</span>
                  </div>
                  <p className="text-xs text-emerald-800/90 leading-relaxed">
                    {selectedCampaign.posterVisualConcept}
                  </p>
                  <div className="pt-2 text-[11px] text-gray-500">
                    Call To Action: <strong>"{selectedCampaign.callToAction}"</strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ==========================================
// 5. WASTE TRACKER SECTION
// ==========================================

function WasteTrackerSection({
  waste,
  batches,
  currency,
  expiredBatches,
  onRecordWasteDirect,
  onQuickDisposeExpired,
}: {
  waste: WasteRecord[];
  batches: InventoryBatch[];
  currency: string;
  expiredBatches: any[];
  onRecordWasteDirect: () => void;
  onQuickDisposeExpired: (b: InventoryBatch) => void;
}) {
  const totalCost = waste.reduce((acc, curr) => acc + curr.totalCostWasted, 0);
  const totalUnits = waste.reduce((acc, curr) => acc + curr.quantityWasted, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Waste & Spoilage Tracker</h1>
          <p className="text-xs text-gray-500">
            Strict factual accounting of disposed stock. Never double-counts rescue sales as waste.
          </p>
        </div>
        <button
          onClick={onRecordWasteDirect}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-sm flex items-center justify-center space-x-1.5 transition-all"
        >
          <Trash2 className="w-4 h-4" />
          <span>Record Disposal</span>
        </button>
      </div>

      {/* Immediate Attention: Expired Batches Pending Disposal Logging */}
      {expiredBatches.length > 0 && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-3">
          <div className="flex items-center space-x-2 text-rose-900 font-bold text-sm">
            <ShieldAlert className="w-4 h-4 text-rose-600" />
            <span>Batches Past Date Awaiting Disposal Audit ({expiredBatches.length})</span>
          </div>
          <p className="text-xs text-rose-800">
            Per food-safety guardrails, these items are ineligible for sale or promotion. Record their responsible disposal below.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {expiredBatches.map(({ batch, reason }) => (
              <div key={batch.id} className="p-3 bg-white rounded-xl border border-rose-200 flex items-center justify-between text-xs">
                <div>
                  <div className="font-semibold text-gray-900">{batch.productName}</div>
                  <div className="text-[11px] text-gray-500">{batch.quantity} {batch.unit} • {reason}</div>
                </div>
                <button
                  onClick={() => onQuickDisposeExpired(batch)}
                  className="px-2.5 py-1 bg-rose-600 text-white text-xs font-semibold rounded-lg hover:bg-rose-700"
                >
                  Log Disposal
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Waste Summary Metric Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm flex justify-between items-center">
          <div>
            <div className="text-xs text-gray-500 font-medium uppercase">Total Disposed Units</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{totalUnits} units</div>
          </div>
          <Package className="w-8 h-8 text-gray-300" />
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm flex justify-between items-center">
          <div>
            <div className="text-xs text-gray-500 font-medium uppercase">Total Cost of Disposed Stock</div>
            <div className="text-2xl font-bold text-rose-600 mt-1">{currency}{totalCost.toLocaleString()}</div>
          </div>
          <Trash2 className="w-8 h-8 text-rose-300" />
        </div>
      </div>

      {/* Waste Records Audit Table */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 font-bold text-sm text-gray-900">
          Disposal Log Records
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-4">Quantity</th>
                <th className="py-3 px-4">Root Reason</th>
                <th className="py-3 px-4">Cost Lost</th>
                <th className="py-3 px-4">Audit Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {waste.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-400">
                    No waste or spoilage records logged yet.
                  </td>
                </tr>
              ) : (
                waste.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-500">{item.dateRecorded}</td>
                    <td className="py-3 px-4 font-semibold text-gray-900">{item.productName}</td>
                    <td className="py-3 px-4">{item.quantityWasted} {item.unit}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-gray-100 text-gray-700">
                        {item.reason.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-rose-600">
                      {currency}{item.totalCostWasted.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-gray-500 max-w-xs truncate">{item.notes || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 6. REPORTS & ANALYTICS SECTION
// ==========================================

function ReportsAnalyticsSection({
  profile,
  batches,
  sales,
  waste,
  campaigns,
}: {
  profile: BusinessProfile;
  batches: InventoryBatch[];
  sales: SaleTransaction[];
  waste: WasteRecord[];
  campaigns: DiscountCampaign[];
}) {
  // Financial Comparison Breakdown
  const totalSalesRevenue = sales.reduce((acc, curr) => acc + curr.totalRevenue, 0);
  const totalRescueRevenue = sales.filter(s => s.isRescueSale).reduce((acc, curr) => acc + curr.totalRevenue, 0);
  const totalWasteLoss = waste.reduce((acc, curr) => acc + curr.totalCostWasted, 0);

  // Waste reasons breakdown
  const wasteByReason = useMemo(() => {
    const map: Record<string, number> = {};
    waste.forEach(w => {
      map[w.reason] = (map[w.reason] || 0) + w.totalCostWasted;
    });
    return Object.entries(map).map(([reason, cost]) => ({
      name: reason.replace('_', ' '),
      cost,
    }));
  }, [waste]);

  // Export CSV
  const handleExportCSV = () => {
    let csv = "Type,ID,Product,Date,Quantity,ValueOrRevenue\n";
    sales.forEach(s => {
      csv += `SALE,${s.id},"${s.productName}",${s.saleDate},${s.quantitySold},${s.totalRevenue}\n`;
    });
    waste.forEach(w => {
      csv += `WASTE,${w.id},"${w.productName}",${w.dateRecorded},${w.quantityWasted},${w.totalCostWasted}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `freshsave-report-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-xs text-gray-500">
            Transparent commercial metrics separating rescue recoveries from unavoidable waste.
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          className="px-3.5 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-semibold rounded-xl shadow-sm flex items-center space-x-1.5 transition-all"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Records CSV</span>
        </button>
      </div>

      {/* Financial Comparison Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm">
          <div className="text-xs text-gray-500 font-medium uppercase">Gross Sales Revenue</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">
            {profile.currency}{totalSalesRevenue.toLocaleString()}
          </div>
          <div className="text-[11px] text-gray-400 mt-1">Normal + Rescue sales combined</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm">
          <div className="text-xs text-emerald-800 font-medium uppercase">Rescue Sale Revenue</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1">
            {profile.currency}{totalRescueRevenue.toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-600 mt-1">Revenue recovered before expiry</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm">
          <div className="text-xs text-rose-800 font-medium uppercase">Actual Waste Loss</div>
          <div className="text-2xl font-bold text-rose-600 mt-1">
            {profile.currency}{totalWasteLoss.toLocaleString()}
          </div>
          <div className="text-[11px] text-rose-500 mt-1">Cost basis of discarded stock</div>
        </div>
      </div>

      {/* Chart: Waste Cost by Root Cause */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-6 space-y-4">
        <div>
          <h2 className="text-base font-bold text-gray-900">Waste Cost by Root Cause</h2>
          <p className="text-xs text-gray-500">Helps pinpoint where purchasing or production should be adjusted</p>
        </div>
        <div className="h-60 w-full">
          {wasteByReason.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-gray-400">
              No waste records to display
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={wasteByReason} margin={{ top: 10, right: 20, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                <XAxis dataKey="name" stroke="#6B7280" fontSize={11} />
                <YAxis stroke="#6B7280" fontSize={11} />
                <Tooltip 
                  formatter={(val: any) => [`${profile.currency}${val}`, 'Cost Lost']}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '12px' }}
                />
                <Bar dataKey="cost" fill="#E11D48" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 7. SETTINGS & PROFILE SECTION
// ==========================================

function SettingsSection({
  profile,
  batches,
  sales,
  waste,
  campaigns,
  onSaveProfile,
  onRestoreBackup,
}: {
  profile: BusinessProfile;
  batches: InventoryBatch[];
  sales: SaleTransaction[];
  waste: WasteRecord[];
  campaigns: DiscountCampaign[];
  onSaveProfile: (p: BusinessProfile) => void;
  onRestoreBackup: (data: any) => void;
}) {
  const [formData, setFormData] = useState<BusinessProfile>({ ...profile });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportBackup = () => {
    const backupData = {
      profile,
      batches,
      sales,
      waste,
      campaigns,
      exportedAt: new Date().toISOString(),
    };
    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `freshsave-backup-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        onRestoreBackup(parsed);
      } catch (err) {
        alert('Invalid JSON backup file structure.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Business Configuration</h1>
        <p className="text-xs text-gray-500">
          Set food safety warning thresholds, acceptable margin floors, and data backups.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-6 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Business Name</label>
          <input 
            type="text" 
            value={formData.businessName}
            onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
            className="w-full text-xs p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#14532D]"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Business Type</label>
          <select
            value={formData.businessType}
            onChange={(e) => setFormData({ ...formData, businessType: e.target.value as BusinessType })}
            className="w-full text-xs p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#14532D]"
          >
            <option value="Bakery or cake shop">Bakery or cake shop</option>
            <option value="Grocery or fruit and vegetable shop">Grocery or fruit and vegetable shop</option>
            <option value="Restaurant or café">Restaurant or café</option>
            <option value="Food stall">Food stall</option>
            <option value="Small food producer">Small food producer</option>
            <option value="Other food business">Other food business</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Currency Symbol</label>
            <input 
              type="text" 
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              className="w-full text-xs p-2.5 bg-gray-50 border border-gray-200 rounded-xl"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Default Copy Language</label>
            <select
              value={formData.preferredLanguage}
              onChange={(e) => setFormData({ ...formData, preferredLanguage: e.target.value as any })}
              className="w-full text-xs p-2.5 bg-gray-50 border border-gray-200 rounded-xl"
            >
              <option value="en">English</option>
              <option value="hi">Hindi (हिंदी)</option>
              <option value="mr">Marathi (मराठी)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Warning Window (Days before Expiry)
            </label>
            <input 
              type="number" 
              min={1} 
              max={14} 
              value={formData.warningDaysThreshold}
              onChange={(e) => setFormData({ ...formData, warningDaysThreshold: parseInt(e.target.value) || 2 })}
              className="w-full text-xs p-2.5 bg-gray-50 border border-gray-200 rounded-xl"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Minimum Acceptable Margin (%)
            </label>
            <input 
              type="number" 
              min={0} 
              max={80} 
              value={formData.minAcceptableMarginPercent}
              onChange={(e) => setFormData({ ...formData, minAcceptableMarginPercent: parseFloat(e.target.value) || 10 })}
              className="w-full text-xs p-2.5 bg-gray-50 border border-gray-200 rounded-xl"
            />
          </div>
        </div>

        <button
          onClick={() => onSaveProfile(formData)}
          className="w-full py-2.5 bg-[#14532D] hover:bg-[#0f3d21] text-white text-xs font-semibold rounded-xl transition-all shadow-sm"
        >
          Save Configuration
        </button>
      </div>

      {/* Backup & Restore Card */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-6 space-y-3">
        <h3 className="text-sm font-bold text-gray-900">Local Data Backup & Recovery</h3>
        <p className="text-xs text-gray-500 leading-relaxed">
          Your data is persisted in browser LocalStorage. Download an offline JSON backup or restore an existing backup file.
        </p>
        <div className="flex items-center space-x-3 pt-2">
          <button
            onClick={handleExportBackup}
            className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download JSON Backup</span>
          </button>

          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept=".json" 
            className="hidden" 
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Restore from File</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// MODAL IMPLEMENTATIONS
// ==========================================

function AddBatchModal({
  currency,
  onClose,
  onSave,
}: {
  currency: string;
  onClose: () => void;
  onSave: (batch: InventoryBatch) => void;
}) {
  const [productName, setProductName] = useState('');
  const [category, setCategory] = useState('Fresh Baked Goods');
  const [quantity, setQuantity] = useState(15);
  const [unit, setUnit] = useState<any>('pcs');
  const [purchaseCost, setPurchaseCost] = useState(40);
  const [sellingPrice, setSellingPrice] = useState(100);
  const [expiryDate, setExpiryDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().split('T')[0];
  });
  const [batchNumber, setBatchNumber] = useState(`BATCH-${Math.floor(100 + Math.random() * 900)}`);
  const [storageNotes, setStorageNotes] = useState('Room temperature display');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim() || quantity <= 0) {
      alert('Please provide valid product name and positive quantity.');
      return;
    }

    const newBatch: InventoryBatch = {
      id: `batch-${Date.now()}`,
      productName: productName.trim(),
      category,
      quantity,
      initialQuantity: quantity,
      unit,
      purchaseCostPerUnit: purchaseCost,
      sellingPricePerUnit: sellingPrice,
      dateReceived: new Date().toISOString().split('T')[0],
      expiryDate,
      batchNumber,
      storageNotes,
      conditionNotes: 'Good',
      isUnsafe: false,
      isArchived: false,
      createdAt: Date.now(),
    };

    onSave(newBatch);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">Add Inventory Batch</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-gray-700 mb-1">Product Name *</label>
            <input 
              type="text" 
              required
              placeholder="e.g., Artisanal Blueberry Scones"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#14532D]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Category</label>
              <input 
                type="text" 
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Batch Code</label>
              <input 
                type="text" 
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Quantity *</label>
              <input 
                type="number" 
                min={1} 
                required
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Unit</label>
              <select 
                value={unit}
                onChange={(e) => setUnit(e.target.value as any)}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl"
              >
                <option value="pcs">Pieces (pcs)</option>
                <option value="kg">Kilograms (kg)</option>
                <option value="g">Grams (g)</option>
                <option value="L">Litres (L)</option>
                <option value="packs">Packs</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Cost Price Per Unit ({currency})</label>
              <input 
                type="number" 
                min={0}
                value={purchaseCost}
                onChange={(e) => setPurchaseCost(parseFloat(e.target.value) || 0)}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Regular Selling Price ({currency})</label>
              <input 
                type="number" 
                min={0}
                value={sellingPrice}
                onChange={(e) => setSellingPrice(parseFloat(e.target.value) || 0)}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-gray-700 mb-1">Use-by / Expiry Date *</label>
            <input 
              type="date" 
              required
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl"
            />
          </div>

          <div>
            <label className="block font-semibold text-gray-700 mb-1">Storage Instructions</label>
            <input 
              type="text" 
              value={storageNotes}
              onChange={(e) => setStorageNotes(e.target.value)}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl"
            />
          </div>

          <div className="pt-3 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#14532D] hover:bg-[#0f3d21] text-white rounded-xl font-semibold shadow-sm"
            >
              Save Batch
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RecordSaleModal({
  batches,
  initialBatch,
  currency,
  onClose,
  onSave,
}: {
  batches: InventoryBatch[];
  initialBatch: InventoryBatch | null;
  currency: string;
  onClose: () => void;
  onSave: (sale: SaleTransaction) => void;
}) {
  const [selectedBatchId, setSelectedBatchId] = useState(initialBatch?.id || (batches[0]?.id || ''));
  const currentBatch = batches.find(b => b.id === selectedBatchId);
  const [quantitySold, setQuantitySold] = useState(1);
  const [isRescueSale, setIsRescueSale] = useState(false);
  const [unitPrice, setUnitPrice] = useState(currentBatch?.sellingPricePerUnit || 100);

  useEffect(() => {
    if (currentBatch) {
      setUnitPrice(currentBatch.sellingPricePerUnit);
    }
  }, [selectedBatchId, currentBatch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentBatch || quantitySold <= 0 || quantitySold > currentBatch.quantity) {
      alert(`Invalid quantity. Current stock is ${currentBatch?.quantity || 0}.`);
      return;
    }

    const sale: SaleTransaction = {
      id: `sale-${Date.now()}`,
      batchId: currentBatch.id,
      productName: currentBatch.productName,
      quantitySold,
      unitPrice,
      saleDate: new Date().toISOString().split('T')[0],
      isRescueSale,
      originalUnitPrice: currentBatch.sellingPricePerUnit,
      totalRevenue: unitPrice * quantitySold,
      costOfSoldStock: currentBatch.purchaseCostPerUnit * quantitySold,
    };

    onSave(sale);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">Record Product Sale</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-gray-700 mb-1">Select Active Batch</label>
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl"
            >
              {batches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.productName} ({b.quantity} {b.unit} available)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Quantity Sold</label>
              <input 
                type="number" 
                min={1} 
                max={currentBatch?.quantity || 1} 
                value={quantitySold}
                onChange={(e) => setQuantitySold(parseInt(e.target.value) || 1)}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Unit Price Sold ({currency})</label>
              <input 
                type="number" 
                min={0} 
                value={unitPrice}
                onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl"
              />
            </div>
          </div>

          <div className="p-3 bg-gray-50 rounded-xl border border-gray-200/70 flex items-center space-x-2">
            <input 
              type="checkbox" 
              id="rescueCheck"
              checked={isRescueSale}
              onChange={(e) => setIsRescueSale(e.target.checked)}
              className="rounded text-[#14532D] focus:ring-0"
            />
            <label htmlFor="rescueCheck" className="text-xs text-gray-700 font-medium">
              Tag as Rescue Sale (discounted to prevent waste before expiry)
            </label>
          </div>

          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-900 font-semibold text-xs flex justify-between">
            <span>Total Sale Revenue:</span>
            <span>{currency}{(unitPrice * quantitySold).toLocaleString()}</span>
          </div>

          <div className="pt-3 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#14532D] hover:bg-[#0f3d21] text-white rounded-xl font-semibold shadow-sm"
            >
              Confirm Sale
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RecordWasteModal({
  batches,
  initialBatch,
  currency,
  onClose,
  onSave,
}: {
  batches: InventoryBatch[];
  initialBatch: InventoryBatch | null;
  currency: string;
  onClose: () => void;
  onSave: (waste: WasteRecord) => void;
}) {
  const [selectedBatchId, setSelectedBatchId] = useState(initialBatch?.id || (batches[0]?.id || ''));
  const currentBatch = batches.find(b => b.id === selectedBatchId);
  const [quantityWasted, setQuantityWasted] = useState(currentBatch?.quantity || 1);
  const [reason, setReason] = useState<any>('expiry');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (currentBatch) {
      setQuantityWasted(currentBatch.quantity);
    }
  }, [selectedBatchId, currentBatch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentBatch || quantityWasted <= 0 || quantityWasted > currentBatch.quantity) {
      alert(`Invalid disposal quantity. Batch stock is ${currentBatch?.quantity || 0}.`);
      return;
    }

    const wasteRecord: WasteRecord = {
      id: `waste-${Date.now()}`,
      batchId: currentBatch.id,
      productName: currentBatch.productName,
      quantityWasted,
      unit: currentBatch.unit,
      costPerUnit: currentBatch.purchaseCostPerUnit,
      totalCostWasted: currentBatch.purchaseCostPerUnit * quantityWasted,
      reason,
      dateRecorded: new Date().toISOString().split('T')[0],
      notes,
    };

    onSave(wasteRecord);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">Record Stock Disposal / Waste</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-gray-700 mb-1">Select Batch for Disposal</label>
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl"
            >
              {batches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.productName} ({b.quantity} {b.unit} remaining)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Quantity Disposed</label>
              <input 
                type="number" 
                min={1} 
                max={currentBatch?.quantity || 1} 
                value={quantityWasted}
                onChange={(e) => setQuantityWasted(parseInt(e.target.value) || 1)}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Disposal Reason</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as any)}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl"
              >
                <option value="expiry">Passed Safe Date / Expiry</option>
                <option value="spoilage">Early Spoilage / Visual Degradation</option>
                <option value="damage">Storage or Handling Damage</option>
                <option value="preparation_surplus">Unsold Preparation Surplus</option>
                <option value="other">Other Reason</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-gray-700 mb-1">Disposal Notes / Method</label>
            <input 
              type="text" 
              placeholder="e.g., Donated to compost bin; packaging recycled"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl"
            />
          </div>

          <div className="p-3 bg-rose-50 rounded-xl border border-rose-100 text-rose-900 font-semibold text-xs flex justify-between">
            <span>Estimated Financial Loss:</span>
            <span>{currency}{((currentBatch?.purchaseCostPerUnit || 0) * quantityWasted).toLocaleString()}</span>
          </div>

          <div className="pt-3 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold shadow-sm"
            >
              Confirm Disposal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreateCampaignModal({
  eligibleBatches,
  initialBatch,
  profile,
  onClose,
  onSave,
}: {
  eligibleBatches: InventoryBatch[];
  initialBatch: InventoryBatch | null;
  profile: BusinessProfile;
  onClose: () => void;
  onSave: (campaign: DiscountCampaign) => void;
}) {
  const [selectedBatchId, setSelectedBatchId] = useState(initialBatch?.id || (eligibleBatches[0]?.id || ''));
  const currentBatch = eligibleBatches.find(b => b.id === selectedBatchId) || eligibleBatches[0];

  const [discountPercent, setDiscountPercent] = useState(25);
  const [language, setLanguage] = useState<'en' | 'hi' | 'mr'>(profile.preferredLanguage);
  const [tone, setTone] = useState<'friendly' | 'professional' | 'festive' | 'urgent'>('friendly');
  const [isGenerating, setIsGenerating] = useState(false);

  // Pricing calculations
  const pricing = useMemo(() => {
    if (!currentBatch) {
      return { proposedPrice: 0, estimatedMarginPercent: 0, isMarginViolated: false, grossProfitPerUnit: 0 };
    }
    return calculateDeterministicPricing(
      currentBatch.purchaseCostPerUnit,
      currentBatch.sellingPricePerUnit,
      discountPercent,
      profile.minAcceptableMarginPercent
    );
  }, [currentBatch, discountPercent, profile.minAcceptableMarginPercent]);

  // Generate promotional copy (Multi-language template engine)
  const generatedCopy = useMemo(() => {
    if (!currentBatch) {
      return { whatsapp: '', instagram: '', headline: '', cta: '', visual: '' };
    }

    const name = currentBatch.productName;
    const price = pricing.proposedPrice;
    const orig = currentBatch.sellingPricePerUnit;
    const cur = profile.currency;

    if (language === 'hi') {
      return {
        whatsapp: `🌱 फ्रेशसेव स्पेशल ऑफर! हमारा ताज़ा "${name}" आज शाम केवल ${cur}${price} में उपलब्ध है (मूल्य ${cur}${orig})। केवल ${currentBatch.quantity} यूनिट्स शेष हैं। सुरक्षित रखने के लिए तुरंत WhatsApp रिप्लाई करें!`,
        instagram: `स्वादिष्ट खाना बचाएं! 🍰 आज हमारे "${name}" पर पाएं ${discountPercent}% की विशेष छूट। भोजन की बर्बादी रोकें और बढ़िया स्वाद का आनंद लें। केवल आज रात 9 बजे तक उपलब्ध! #FreshSave #ZeroWaste #FoodLovers`,
        headline: `आज शाम की स्पेशल छूट: ${name} पर ${discountPercent}% की बचत!`,
        cta: `अभी बुक करने के लिए 'हाँ' लिखकर भेजें`,
        visual: `Clean emerald background with decorative gold lettering: "${discountPercent}% OFF FRESH SAVE", item picture centered, and callout badge.`,
      };
    }

    if (language === 'mr') {
      return {
        whatsapp: `🌿 फ्रेशसेव्ह विशेष ऑफर! आमचे ताजेतवाने "${name}" आज संध्याकाळी फक्त ${cur}${price} मध्ये उपलब्ध (मूळ किंमत ${cur}${orig})। शिल्लक: फक्त ${currentBatch.quantity} नग। आत्ताच रिप्लाय देऊन बुक करा!`,
        instagram: `अन्नाची नासाडी थांबवा! 🧁 आजच्या ताज्या "${name}" वर मिळवा विशेष ${discountPercent}% सूट। चवदार अन्न आणि पैशांची खरी बचत. आजच भेट द्या किंवा ऑर्डर करा! #FreshSave #PuneFoodie #SaveFood`,
        headline: `आज संध्याकाळची खास ऑफर: ${name} वर ${discountPercent}% सूट!`,
        cta: `आत्ताच ऑर्डर करण्यासाठी रिप्लाय करा`,
        visual: `Warm ivory card with rustic olive border and Marathi header with prominent price sticker: "${cur}${price}".`,
      };
    }

    // Default English
    return {
      whatsapp: `🌿 FreshSave Flash Treat! Enjoy our freshly prepared "${name}" for only ${cur}${price} (Regular ${cur}${orig}). Only ${currentBatch.quantity} ${currentBatch.unit} left before closing! Reply to reserve your portion.`,
      instagram: `Save good food & sweeten your evening! 🥐 Pick up our signature "${name}" at ${discountPercent}% OFF before closing tonight. High quality, zero waste! #FreshSave #ZeroWasteFood #SupportLocal`,
      headline: `Evening Flash Rescue: ${discountPercent}% Off ${name}!`,
      cta: `Reply YES to claim your order`,
      visual: `Minimalist forest green banner with bold typography: "RESCUE OFFER - ${discountPercent}% OFF", high-contrast price badge and eco-leaf icon.`,
    };
  }, [currentBatch, pricing, discountPercent, language, profile.currency]);

  const handleCreate = () => {
    if (!currentBatch) return;

    const newCampaign: DiscountCampaign = {
      id: `camp-${Date.now()}`,
      batchId: currentBatch.id,
      productName: currentBatch.productName,
      originalPrice: currentBatch.sellingPricePerUnit,
      discountedPrice: pricing.proposedPrice,
      discountPercent,
      estimatedMarginPercent: pricing.estimatedMarginPercent,
      quantityOffered: currentBatch.quantity,
      language,
      tone,
      whatsappMessage: generatedCopy.whatsapp,
      instagramCaption: generatedCopy.instagram,
      headline: generatedCopy.headline,
      callToAction: generatedCopy.cta,
      posterVisualConcept: generatedCopy.visual,
      status: 'approved',
      createdAt: new Date().toISOString().split('T')[0],
    };

    onSave(newCampaign);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-gray-100 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-gray-900">Create a Rescue Offer</h3>
            <p className="text-xs text-gray-500">Only eligible stock approaching expiration is shown.</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {eligibleBatches.length === 0 ? (
          <div className="text-center py-8 text-xs text-gray-500">
            No eligible at-risk stock available to discount. Expired items cannot be promoted.
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Select Eligible Product</label>
              <select
                value={selectedBatchId}
                onChange={(e) => setSelectedBatchId(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl"
              >
                {eligibleBatches.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.productName} ({b.quantity} {b.unit} available • Expiry: {b.expiryDate})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Discount Level (%)</label>
                <input 
                  type="number" 
                  min={5} 
                  max={80} 
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(parseInt(e.target.value) || 20)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Copy Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as any)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl"
                >
                  <option value="en">English</option>
                  <option value="hi">Hindi (हिंदी)</option>
                  <option value="mr">Marathi (मराठी)</option>
                </select>
              </div>
            </div>

            {/* Price & Margin Calculation Card */}
            <div className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
              pricing.isMarginViolated 
                ? 'bg-amber-50 border-amber-200 text-amber-900' 
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}>
              <div className="flex justify-between items-center font-bold">
                <span>Proposed Rescue Price:</span>
                <span className="text-sm">{profile.currency}{pricing.proposedPrice} <span className="font-normal line-through text-gray-400">({profile.currency}{currentBatch?.sellingPricePerUnit})</span></span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span>Estimated Gross Margin:</span>
                <span className="font-semibold">{pricing.estimatedMarginPercent}%</span>
              </div>
              {pricing.isMarginViolated && (
                <div className="text-[11px] font-semibold text-amber-800 flex items-center space-x-1 pt-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Notice: Margin is below your configured minimum ({profile.minAcceptableMarginPercent}%).</span>
                </div>
              )}
            </div>

            {/* Generated Message Preview */}
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-1.5">
              <span className="font-bold text-gray-800 text-[11px]">Generated Message Preview:</span>
              <p className="text-gray-700 text-xs italic bg-white p-2.5 rounded-lg border border-gray-100">
                "{generatedCopy.whatsapp}"
              </p>
            </div>

            <div className="pt-3 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                className="px-4 py-2 bg-[#14532D] hover:bg-[#0f3d21] text-white rounded-xl font-semibold shadow-sm"
              >
                Launch & Save Campaign
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}