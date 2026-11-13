import React from 'react';
import { X, ShieldCheck, Server, Sparkles } from 'lucide-react';

export interface AdminCommercialConsoleModalProps {
  isOpen: boolean;
  subscriptionTier: 'free' | 'pro';
  billingCycle: 'monthly' | 'annual';
  onChangeBillingCycle: (cycle: 'monthly' | 'annual') => void;
  onActivatePro: () => void;
  onClose: () => void;
}

export const AdminCommercialConsoleModal: React.FC<
  AdminCommercialConsoleModalProps
> = ({
  isOpen,
  subscriptionTier,
  billingCycle,
  onChangeBillingCycle,
  onActivatePro,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="LearnMate Pro Aspirant Subscription"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-3xl p-6 space-y-5 text-slate-900 dark:text-white">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <span className="px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-extrabold uppercase tracking-wider inline-flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Commercial Student Plans • JEE Main, Advanced, NEET UG &amp; BITSAT
            </span>
            <h2 className="text-xl font-extrabold mt-1.5">
              Upgrade to LearnMate Pro Aspirant
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Pro Modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Billing Cycle Toggle */}
        <div className="flex items-center justify-between flex-wrap gap-3 bg-slate-50 dark:bg-slate-800/70 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700">
          <div className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Includes JEE Main, JEE Advanced, NEET UG &amp; BITSAT Mock Engines + Cloud Sync</span>
          </div>
          <div className="inline-flex rounded-xl bg-white dark:bg-slate-900 p-1 border border-slate-200 dark:border-slate-700 text-xs font-extrabold">
            <button
              type="button"
              onClick={() => onChangeBillingCycle('monthly')}
              className={`px-3 py-1.5 rounded-lg cursor-pointer ${
                billingCycle === 'monthly'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              Monthly (₹499/mo)
            </button>
            <button
              type="button"
              onClick={() => onChangeBillingCycle('annual')}
              className={`px-3 py-1.5 rounded-lg cursor-pointer ${
                billingCycle === 'annual'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              Annual Exam Pass (₹2,999/yr • Save 50%)
            </button>
          </div>
        </div>

        {/* Free vs Pro Comparison Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-3 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-sm">Free Aspirant Tier</span>
                <span className="font-black text-base text-slate-700 dark:text-slate-200">
                  ₹0 / forever
                </span>
              </div>
              <ul className="space-y-2 text-slate-600 dark:text-slate-300 font-medium">
                <li>• Up to 5 AI Document / Marathon Scans per day</li>
                <li>• Official PYQ Bank &amp; Standard Chapter Notes</li>
                <li>• 2 Full CBT Mock Tests per month</li>
                <li>• Local Browser Storage + Basic Formula Book</li>
              </ul>
            </div>
            <div className="pt-3 border-t border-slate-200/80 dark:border-slate-700 text-[11px] font-bold text-slate-500">
              {subscriptionTier === 'free' ? 'Current Active Plan' : 'Included in your account'}
            </div>
          </div>

          <div className="p-5 rounded-2xl border-2 border-indigo-600 bg-indigo-50/30 dark:bg-indigo-950/30 space-y-3 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-sm text-indigo-600 dark:text-indigo-400">
                  Pro Aspirant Pass
                </span>
                <span className="font-black text-base text-slate-900 dark:text-white">
                  {billingCycle === 'annual' ? '₹2,999 / year' : '₹499 / month'}
                </span>
              </div>
              <ul className="space-y-2 text-slate-700 dark:text-slate-200 font-semibold">
                <li>• Unlimited 12-Hour YouTube Marathon Timestamp Extractions</li>
                <li>• Unlimited Full-Screen Proctored CBT Mocks (JEE, NEET UG, BITSAT)</li>
                <li>• Live Classroom Voice AI Tutor (Hindi, Hinglish &amp; Indian English)</li>
                <li>• Interactive 2D Vector Diagram Maker, 3D WebGL Lab &amp; Cloud Sync</li>
              </ul>
            </div>
            {subscriptionTier === 'pro' ? (
              <div className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-center font-extrabold">
                ✓ Pro Aspirant Active
              </div>
            ) : (
              <button
                type="button"
                onClick={onActivatePro}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold shadow-sm cursor-pointer"
              >
                Activate Pro Aspirant Pass Now
              </button>
            )}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1.5 font-semibold">
            <Server className="w-3.5 h-3.5 text-indigo-600" />
            Protected by RS256 Firebase Auth, Token-Bucket Rate Limiter &amp; Server-Authoritative CBT Grading
          </span>
          <span className="font-extrabold text-emerald-600">100% Parity Active</span>
        </div>
      </div>
    </div>
  );
};
