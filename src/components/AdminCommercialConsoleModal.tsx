import React, { useEffect, useState } from 'react';
import { X, ShieldCheck, Server, Sparkles, AlertTriangle, Receipt, Building2 } from 'lucide-react';
import { fetchBillingInvoices } from '../services/workspaceService';

export interface AdminCommercialConsoleModalProps {
  isOpen: boolean;
  subscriptionTier: 'free' | 'pro' | 'institute';
  subscriptionStatus: string;
  paymentsConfigured: boolean;
  billingError: string | null;
  billingCycle: 'monthly' | 'annual';
  onChangeBillingCycle: (cycle: 'monthly' | 'annual') => void;
  onStartCheckout: (planId?: 'pro_aspirant' | 'institute_cohort') => Promise<void> | void;
  onClose: () => void;
}

export const AdminCommercialConsoleModal: React.FC<
  AdminCommercialConsoleModalProps
> = ({
  isOpen,
  subscriptionTier,
  subscriptionStatus,
  paymentsConfigured,
  billingError,
  billingCycle,
  onChangeBillingCycle,
  onStartCheckout,
  onClose,
}) => {
  const [submittingPlan, setSubmittingPlan] = useState<'pro_aspirant' | 'institute_cohort' | null>(null);
  const [invoices, setInvoices] = useState<
    {
      invoiceId: string;
      planId: string;
      amountInr: number;
      currency: string;
      status: string;
      createdAtIso: string;
    }[]
  >([]);

  useEffect(() => {
    if (!isOpen) return;
    fetchBillingInvoices()
      .then((res) => {
        if (res.ok && res.data?.invoices) {
          setInvoices(res.data.invoices);
        }
      })
      .catch(() => {});
  }, [isOpen, subscriptionTier]);

  if (!isOpen) return null;

  const triggerCheckout = async (planId: 'pro_aspirant' | 'institute_cohort') => {
    setSubmittingPlan(planId);
    try {
      await onStartCheckout(planId);
    } finally {
      setSubmittingPlan(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="LearnMate Plans and Billing"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-4xl p-6 space-y-5 text-slate-900 dark:text-white my-8">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <span className="px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-extrabold uppercase tracking-wider inline-flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Plans &amp; Entitlements · Verified Webhook Billing
            </span>
            <h2 className="text-xl font-extrabold mt-1.5">
              LearnMate JEE Plans (Current: {subscriptionTier.toUpperCase()} · {subscriptionStatus})
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
            <span>
              Gateway Status:{' '}
              <strong className={paymentsConfigured ? 'text-emerald-600' : 'text-amber-600'}>
                {paymentsConfigured
                  ? 'Live Checkout Ready (HMAC Verified)'
                  : 'Gateway Keys Not Provisioned (Checkout Returns 503 Honest Notice)'}
              </strong>
            </span>
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
              Monthly
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
              Annual Exam Pass (Save 50%)
            </button>
          </div>
        </div>

        {billingError && (
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-extrabold">Billing Gateway Notice</div>
              <p className="mt-0.5">{billingError}</p>
            </div>
          </div>
        )}

        {/* Free vs Pro vs Institute Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-3 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-sm">Free Aspirant</span>
                <span className="font-black text-base text-slate-700 dark:text-slate-200">
                  ₹0
                </span>
              </div>
              <ul className="space-y-2 text-slate-600 dark:text-slate-300 font-medium">
                <li>• 20 AI Tutor queries / day</li>
                <li>• Official PYQ Bank &amp; Standard Chapter Notes</li>
                <li>• 2 Full CBT Mock Tests per month</li>
                <li>• IndexedDB local storage &amp; Mistake Book</li>
              </ul>
            </div>
            <div className="pt-3 border-t border-slate-200/80 dark:border-slate-700 text-[11px] font-bold text-slate-500">
              {subscriptionTier === 'free' ? 'Current Active Tier' : 'Included in account'}
            </div>
          </div>

          <div className="p-5 rounded-2xl border-2 border-indigo-600 bg-indigo-50/30 dark:bg-indigo-950/30 space-y-3 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-sm text-indigo-600 dark:text-indigo-400">
                  Pro Aspirant
                </span>
                <span className="font-black text-base text-slate-900 dark:text-white">
                  {billingCycle === 'annual' ? '₹2,999 / yr' : '₹499 / mo'}
                </span>
              </div>
              <ul className="space-y-2 text-slate-700 dark:text-slate-200 font-semibold">
                <li>• 250 AI Tutor queries / day &amp; 60+ page PDFs</li>
                <li>• Unlimited Full-Screen Proctored CBT Mocks</li>
                <li>• Live Classroom Voice AI Tutor</li>
                <li>• 2D Vector Diagram Maker &amp; 3D WebGL Lab</li>
              </ul>
            </div>
            {subscriptionTier === 'pro' ? (
              <div className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-center font-extrabold">
                ✓ Pro Aspirant Active
              </div>
            ) : (
              <button
                type="button"
                disabled={submittingPlan !== null}
                onClick={() => triggerCheckout('pro_aspirant')}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-extrabold shadow-sm cursor-pointer"
              >
                {submittingPlan === 'pro_aspirant'
                  ? 'Contacting Billing Server...'
                  : 'Continue to Pro Checkout'}
              </button>
            )}
          </div>

          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-3 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-sm flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-indigo-600" />
                  Institute Seat
                </span>
                <span className="font-black text-base text-slate-900 dark:text-white">
                  {billingCycle === 'annual' ? '₹14,999 / yr' : '₹1,999 / mo'}
                </span>
              </div>
              <ul className="space-y-2 text-slate-600 dark:text-slate-300 font-medium">
                <li>• 1,000 AI Tutor queries / day per cohort seat</li>
                <li>• Multi-batch analytics &amp; shared test banks</li>
                <li>• Priority ingestion queue &amp; audit exports</li>
              </ul>
            </div>
            {subscriptionTier === 'institute' ? (
              <div className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-center font-extrabold">
                ✓ Institute Seat Active
              </div>
            ) : (
              <button
                type="button"
                disabled={submittingPlan !== null}
                onClick={() => triggerCheckout('institute_cohort')}
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 disabled:opacity-60 text-white font-extrabold cursor-pointer"
              >
                {submittingPlan === 'institute_cohort'
                  ? 'Contacting Billing Server...'
                  : 'Institute Checkout'}
              </button>
            )}
          </div>
        </div>

        {/* Verified Invoices */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-2 text-xs">
          <div className="font-extrabold flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
            <Receipt className="w-4 h-4 text-indigo-600" />
            <span>Billing Invoices ({invoices.length})</span>
          </div>
          {invoices.length === 0 ? (
            <div className="text-slate-500">
              No paid invoices on file. Upgrades require verified payment gateway webhook confirmation.
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {invoices.map((inv) => (
                <div key={inv.invoiceId} className="py-1.5 flex items-center justify-between">
                  <span className="font-mono font-bold">{inv.invoiceId}</span>
                  <span>
                    {inv.planId} · ₹{inv.amountInr} ({inv.status})
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1.5 font-semibold">
            <Server className="w-3.5 h-3.5 text-indigo-600" />
            Protected by RS256 Firebase Auth, HMAC-Verified Webhooks &amp; Server-Authoritative Entitlements
          </span>
          <span className="font-extrabold text-indigo-600">No Client Self-Upgrade</span>
        </div>
      </div>
    </div>
  );
};
