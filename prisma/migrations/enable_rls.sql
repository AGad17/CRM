-- Enable RLS on all public tables
-- Safe for Prisma: the postgres/service-role user has BYPASSRLS privilege,
-- so all existing Prisma queries continue to work without any change.
-- These policies silence the Supabase Security Advisor.

ALTER TABLE public.countries                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_pricing          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_rates           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_roles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.next_auth_accounts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_tokens      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_pricing        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addon_pricing            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_trackers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_notes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_tasks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csat_records             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nps_records              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_health_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.handover_documents       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_brands           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_notes            ENABLE ROW LEVEL SECURITY;
