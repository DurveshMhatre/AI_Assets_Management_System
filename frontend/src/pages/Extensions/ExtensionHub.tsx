import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
    TrendingUp, Cog, Building2, Calculator, Monitor,
    Image, Home, Landmark, Wallet, Leaf, ArrowRight, Blocks
} from 'lucide-react';
import api from '../../api/client';

const DOMAINS = [
    {
        key: 'investment', label: 'Investment Management', icon: TrendingUp,
        desc: 'Portfolio tracking, NAV monitoring, dividend & gain analysis',
        color: 'from-emerald-500 to-teal-600', shadow: 'shadow-emerald-200',
        endpoint: '/extensions/investment/portfolio/summary',
    },
    {
        key: 'physical', label: 'Physical Asset Mgmt', icon: Cog,
        desc: 'Lifecycle stages, OEE scores, MTBF/MTTR, predictive maintenance',
        color: 'from-blue-500 to-indigo-600', shadow: 'shadow-blue-200',
        endpoint: '/extensions/physical/lifecycle/summary',
    },
    {
        key: 'infrastructure', label: 'Infrastructure', icon: Building2,
        desc: 'Condition indexing, inspection schedules, GIS, compliance',
        color: 'from-orange-500 to-red-600', shadow: 'shadow-orange-200',
        endpoint: '/extensions/infrastructure/condition/summary',
    },
    {
        key: 'fixed-asset', label: 'Fixed Asset / Accounting', icon: Calculator,
        desc: 'WDV tracking, accounting blocks, impairment, statutory reports',
        color: 'from-violet-500 to-purple-600', shadow: 'shadow-violet-200',
        endpoint: '/extensions/fixed-asset/accounting/register',
    },
    {
        key: 'it', label: 'IT Asset Management', icon: Monitor,
        desc: 'HAM/SAM/CAM tracking, license compliance, cloud costs, EOL alerts',
        color: 'from-cyan-500 to-blue-600', shadow: 'shadow-cyan-200',
        endpoint: '/extensions/it/licenses/compliance',
    },
    {
        key: 'digital', label: 'Digital Asset Mgmt', icon: Image,
        desc: 'Media library, keyword tagging, usage rights, version control',
        color: 'from-pink-500 to-rose-600', shadow: 'shadow-pink-200',
        endpoint: '/extensions/digital/media/library',
    },
    {
        key: 'real-estate', label: 'Real Estate', icon: Home,
        desc: 'Property management, tenancy tracking, rental yield analysis',
        color: 'from-amber-500 to-orange-600', shadow: 'shadow-amber-200',
        endpoint: '/extensions/real-estate/tenancy/summary',
    },
    {
        key: 'government', label: 'Public / Government', icon: Landmark,
        desc: 'GFR classification, GeM portal, custodian tracking, public register',
        color: 'from-slate-500 to-gray-700', shadow: 'shadow-slate-200',
        endpoint: '/extensions/government/public/register',
    },
    {
        key: 'wealth', label: 'Wealth Management', icon: Wallet,
        desc: 'Net worth aggregation, tax optimization, allocation tracking',
        color: 'from-yellow-500 to-amber-600', shadow: 'shadow-yellow-200',
        endpoint: '/extensions/wealth/networth/summary',
    },
    {
        key: 'natural-resource', label: 'Natural Resource', icon: Leaf,
        desc: 'Carbon credits, ecosystem valuation, NDVI, degradation tracking',
        color: 'from-green-500 to-emerald-700', shadow: 'shadow-green-200',
        endpoint: '/extensions/natural-resource/carbon/summary',
    },
];

export default function ExtensionHub() {
    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                    <Blocks className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Domain Extensions</h1>
                    <p className="text-slate-500 text-sm">Modular domain-specific asset management modules</p>
                </div>
            </div>

            {/* Domain Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {DOMAINS.map((d) => (
                    <Link
                        key={d.key}
                        to={`/extensions/${d.key}`}
                        className="group bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden"
                    >
                        <div className={`h-2 bg-gradient-to-r ${d.color}`} />
                        <div className="p-6">
                            <div className="flex items-start justify-between">
                                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${d.color} flex items-center justify-center shadow-lg ${d.shadow}`}>
                                    <d.icon className="w-6 h-6 text-white" />
                                </div>
                                <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900 mt-4 group-hover:text-indigo-600 transition-colors">
                                {d.label}
                            </h3>
                            <p className="text-sm text-slate-500 mt-1 leading-relaxed">{d.desc}</p>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
