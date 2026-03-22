import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AssistRequestModal } from "@/components/marketing/assist-request-modal";
import { LandingViewTracker, SignupStartLink } from "@/components/marketing/landing-analytics";
import { LandingReveal } from "@/components/marketing/landing-reveal";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { getAuthContext } from "@/features/auth/lib/session";
import type { AppLocale } from "@/i18n/messages";
import { getServerI18n } from "@/i18n/server";
import { isDesktopMode } from "@/lib/runtime";

type LandingPlan = {
  navHow: string;
  navPricing: string;
  navFaq: string;
  navSignIn: string;
  heroTag: string;
  heroTitle: string;
  heroSubtitle: string;
  ctaPrimary: string;
  ctaSecondary: string;
  videoCta: string;
  trustItems: string[];
  heroKpis: Array<{ label: string; value: string }>;
  snapshotLabel: string;
  snapshotStatus: string;
  howTitle: string;
  howSubtitle: string;
  steps: Array<{ title: string; description: string }>;
  previewTitle: string;
  previewSubtitle: string;
  previews: Array<{ title: string; description: string }>;
  mediaTitle: string;
  mediaSubtitle: string;
  mediaVisuals: Array<{ title: string; description: string; image: string; imageAlt: string }>;
  mediaVideos: Array<{ title: string; description: string; duration: string; href: string }>;
  profileTitle: string;
  profileSubtitle: string;
  profiles: Array<{ title: string; description: string }>;
  pricingTitle: string;
  pricingSubtitle: string;
  billingMonthly: string;
  billingYearly: string;
  pricingSave: string;
  plans: Array<{
    name: string;
    monthly: string;
    yearly: string;
    note: string;
    features: string[];
    highlighted?: boolean;
  }>;
  assistTitle: string;
  assistSubtitle: string;
  assistPoints: string[];
  faqTitle: string;
  faqItems: Array<{ q: string; a: string }>;
  finalTitle: string;
  finalSubtitle: string;
  footer: string;
};

const SHOW_LEARNING_VIDEOS = false;

const LANDING_COPY: Record<AppLocale, LandingPlan> = {
  fr: {
    navHow: "Comment ca marche",
    navPricing: "Tarifs",
    navFaq: "FAQ",
    navSignIn: "Se connecter",
    heroTag: "Gestion documentaire pour toutes les activites",
    heroTitle: "Pilotez devis, factures et paiements depuis un seul espace clair.",
    heroSubtitle:
      "DOC_v1 centralise clients, articles, templates et relances. Demarrez avec 14 jours gratuits, puis activez le plan adapte a votre volume reel.",
    ctaPrimary: "Creer mon espace (14 jours)",
    ctaSecondary: "Demander un appel de demarrage",
    videoCta: "Voir la video",
    trustItems: ["Essai gratuit 14 jours", "Activation accompagnee", "Export PDF / DOCX / XLSX"],
    heroKpis: [
      { label: "Temps moyen premiere doc", value: "< 10 min" },
      { label: "Rappel avant blocage", value: "70% / 90% / 100%" },
      { label: "SLA rappel commercial", value: "< 24h" },
    ],
    snapshotLabel: "Vue live",
    snapshotStatus: "actif",
    howTitle: "Comment ca marche",
    howSubtitle: "Un flux simple en 3 etapes.",
    steps: [
      { title: "1. Creation de compte", description: "Inscription rapide et acces immediate a votre espace." },
      { title: "2. Essai guide", description: "14 jours pour configurer templates, clients et premier document." },
      { title: "3. Activation", description: "Validation de vos besoins, paiement par virement ou Wafacash, puis activation." },
    ],
    previewTitle: "Apercu produit",
    previewSubtitle: "Des ecrans clairs pour piloter votre activite au quotidien.",
    previews: [
      { title: "Dashboard realiste", description: "KPIs, courbes de tendance, documents recents et paiements." },
      { title: "Documents et templates", description: "Creation rapide, export multi-format et variables dynamiques." },
      { title: "Alertes operationnelles", description: "Notifications avant echeance, retard et limite d'usage." },
    ],
    mediaTitle: "Visuels produit et micro-demonstrations",
    mediaSubtitle: "Apercus reels de l'interface et videos courtes par workflow.",
    mediaVisuals: [
      {
        title: "Vue direction",
        description: "KPIs financiers, activite mensuelle et priorites d'encaissement.",
        image: "/marketing/dashboard-visual.png",
        imageAlt: "Apercu dashboard DOC_v1",
      },
      {
        title: "Flux documents",
        description: "Grille documents, statuts, export de liste et actions rapides.",
        image: "/marketing/documents-visual.svg",
        imageAlt: "Apercu liste documents DOC_v1",
      },
      {
        title: "Controle parametres",
        description: "Facturation, templates, notifications et politiques d'envoi.",
        image: "/marketing/settings-visual.svg",
        imageAlt: "Apercu page parametres DOC_v1",
      },
    ],
    mediaVideos: [
      {
        title: "Demarrage et premiere facture",
        description: "Configurer l'espace, creer client + article, puis generer une facture.",
        duration: "2m 10s",
        href: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
      },
      {
        title: "Templates et variables dynamiques",
        description: "Utiliser les variables, snippets et export PDF/DOCX.",
        duration: "1m 45s",
        href: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
      },
      {
        title: "Activation et preuve de paiement",
        description: "Flux essai -> preuve de paiement -> validation d'activation.",
        duration: "1m 30s",
        href: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
      },
    ],
    profileTitle: "Avantages par profil",
    profileSubtitle: "Concu pour les independants, PME et equipes qui veulent aller vite.",
    profiles: [
      { title: "Freelance", description: "Facturation rapide et suivi des reglements sans complexite." },
      { title: "PME", description: "Process standard pour devis, facture, livraison et commande." },
      { title: "Agence", description: "Templates reutilisables et pilotage de plusieurs clients." },
      { title: "Equipe administrative", description: "Controle des statuts et historique centralise." },
    ],
    pricingTitle: "Tarifs mensuels et annuels (V1)",
    pricingSubtitle: "Plans calcules sur un objectif de marge brute de 80% (PM-020 finalise).",
    billingMonthly: "Mensuel",
    billingYearly: "Annuel",
    pricingSave: "Economisez 20%",
    plans: [
      {
        name: "Starter",
        monthly: "169 MAD / mois",
        yearly: "1620 MAD / an",
        note: "Pour demarrer",
        features: ["Documents essentiels", "Limites de base", "Support standard"],
      },
      {
        name: "Pro",
        monthly: "269 MAD / mois",
        yearly: "2580 MAD / an",
        note: "Plan recommande",
        features: ["Limites augmentees", "Exports avances", "Support prioritaire"],
        highlighted: true,
      },
      {
        name: "Business",
        monthly: "499 MAD / mois",
        yearly: "4790 MAD / an",
        note: "Pour usage intense",
        features: ["Limites elevees", "Equipe et workflows", "Accompagnement dedie"],
      },
    ],
    assistTitle: "Onboarding assiste",
    assistSubtitle: "Pour les utilisateurs non techniques, notre equipe peut demarrer avec vous.",
    assistPoints: [
      "Appel de cadrage apres inscription pour comprendre votre besoin.",
      "Aide sur vos templates, imports et premiere structure documentaire.",
      "Suivi d'activation avec preuve de paiement et validation manuelle.",
    ],
    faqTitle: "Questions frequentes",
    faqItems: [
      { q: "Combien dure l'essai ?", a: "L'essai gratuit dure 14 jours avec notifications progressives avant blocage." },
      { q: "Comment payer au lancement ?", a: "Paiement manuel par virement bancaire ou Wafacash, puis verification interne." },
      { q: "Que se passe-t-il apres l'essai ?", a: "Passage en mode limite puis verrouillage si aucune activation payante." },
      { q: "Puis-je avoir de l'aide au demarrage ?", a: "Oui, un accompagnement commercial et operationnel est disponible." },
    ],
    finalTitle: "Pret a lancer votre flux documentaire ?",
    finalSubtitle: "Activez votre essai gratuit, puis finalisez votre plan selon votre volume reel.",
    footer: "DOC_v1 - Gestion documentaire moderne pour activites en croissance.",
  },
  en: {
    navHow: "How it works",
    navPricing: "Pricing",
    navFaq: "FAQ",
    navSignIn: "Sign in",
    heroTag: "Document workflow for any business",
    heroTitle: "Run quotes, invoices, and payments from one clean workspace.",
    heroSubtitle:
      "DOC_v1 unifies clients, products, templates, and collections follow-up. Start with a 14-day free trial, then activate the plan that matches your real volume.",
    ctaPrimary: "Create workspace (14-day trial)",
    ctaSecondary: "Request onboarding call",
    videoCta: "Watch video",
    trustItems: ["14-day free trial", "Assisted activation", "PDF / DOCX / XLSX export"],
    heroKpis: [
      { label: "First document setup", value: "< 10 min" },
      { label: "Usage warnings", value: "70% / 90% / 100%" },
      { label: "Callback SLA", value: "< 24h" },
    ],
    snapshotLabel: "Live snapshot",
    snapshotStatus: "active",
    howTitle: "How it works",
    howSubtitle: "A clear 3-step flow.",
    steps: [
      { title: "1. Create account", description: "Quick signup and immediate access to your workspace." },
      { title: "2. Guided trial", description: "14 days to configure templates, clients, and your first document." },
      { title: "3. Activation", description: "Need review, payment by wire or Wafacash, then account activation." },
    ],
    previewTitle: "Product preview",
    previewSubtitle: "Focused screens to run daily operations.",
    previews: [
      { title: "Real dashboard", description: "KPIs, trend charts, recent documents, and latest payments." },
      { title: "Documents and templates", description: "Fast creation, multi-format exports, dynamic variables." },
      { title: "Operational alerts", description: "Reminders before due dates, overdue states, and usage limits." },
    ],
    mediaTitle: "Product visuals and quick walkthrough videos",
    mediaSubtitle: "Real interface snapshots plus short videos for core workflows.",
    mediaVisuals: [
      {
        title: "Owner snapshot",
        description: "Financial KPIs, trend lines, and collection priorities.",
        image: "/marketing/dashboard-visual.svg",
        imageAlt: "DOC_v1 dashboard preview",
      },
      {
        title: "Documents workflow",
        description: "Document grid, statuses, list export, and quick actions.",
        image: "/marketing/documents-visual.svg",
        imageAlt: "DOC_v1 documents page preview",
      },
      {
        title: "Settings control",
        description: "Billing lifecycle, templates, notifications, and policies.",
        image: "/marketing/settings-visual.svg",
        imageAlt: "DOC_v1 settings page preview",
      },
    ],
    mediaVideos: [
      {
        title: "Quick start and first invoice",
        description: "Set workspace basics, add a client/product, and issue the first invoice.",
        duration: "2m 10s",
        href: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
      },
      {
        title: "Templates and dynamic variables",
        description: "Use variable snippets and export to PDF/DOCX with consistency.",
        duration: "1m 45s",
        href: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
      },
      {
        title: "Activation and payment proof flow",
        description: "Trial to payment proof submission and manual activation review.",
        duration: "1m 30s",
        href: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
      },
    ],
    profileTitle: "Benefits by profile",
    profileSubtitle: "Built for freelancers, SMBs, and growing teams.",
    profiles: [
      { title: "Freelancer", description: "Fast invoices and payment visibility without heavy setup." },
      { title: "SMB", description: "Consistent quote, invoice, delivery, and order flow." },
      { title: "Agency", description: "Reusable templates and multi-client handling." },
      { title: "Back office", description: "Status control, history, and cleaner follow-up." },
    ],
    pricingTitle: "Monthly and yearly plans (V1)",
    pricingSubtitle: "Plans aligned with an 80% gross-margin target (PM-020 finalized).",
    billingMonthly: "Monthly",
    billingYearly: "Yearly",
    pricingSave: "Save 20%",
    plans: [
      {
        name: "Starter",
        monthly: "169 MAD / month",
        yearly: "1620 MAD / year",
        note: "Get started",
        features: ["Core documents", "Base limits", "Standard support"],
      },
      {
        name: "Pro",
        monthly: "269 MAD / month",
        yearly: "2580 MAD / year",
        note: "Most popular",
        features: ["Higher limits", "Advanced exports", "Priority support"],
        highlighted: true,
      },
      {
        name: "Business",
        monthly: "499 MAD / month",
        yearly: "4790 MAD / year",
        note: "Heavy usage",
        features: ["High limits", "Team workflows", "Dedicated assistance"],
      },
    ],
    assistTitle: "Assisted onboarding",
    assistSubtitle: "If your team is not technical, we help you launch quickly.",
    assistPoints: [
      "Needs call right after signup.",
      "Hands-on help for templates, imports, and first documents.",
      "Manual payment proof review and activation checklist.",
    ],
    faqTitle: "Frequently asked questions",
    faqItems: [
      { q: "How long is the trial?", a: "The free trial lasts 14 days with progressive warnings before lock." },
      { q: "How do I pay at launch?", a: "Manual payment by bank transfer or Wafacash, then internal review." },
      { q: "What happens after trial?", a: "Limited state, then hard lock if no paid activation is confirmed." },
      { q: "Can I get onboarding help?", a: "Yes, sales and operational assistance is available." },
    ],
    finalTitle: "Ready to launch your document workflow?",
    finalSubtitle: "Start free, then choose your plan based on real usage.",
    footer: "DOC_v1 - Modern document operations for growing businesses.",
  },
  ar: {
    navHow: "كيف يعمل",
    navPricing: "الاسعار",
    navFaq: "الاسئلة",
    navSignIn: "تسجيل الدخول",
    heroTag: "منصة الوثائق لكل انواع الاعمال",
    heroTitle: "ادارة العروض والفواتير والتحصيل من مساحة واحدة واضحة.",
    heroSubtitle:
      "DOC_v1 يجمع العملاء والمواد والقوالب والمتابعة المالية في نظام موحد. ابدأ بتجربة 14 يوما ثم فعّل الخطة المناسبة لحجم نشاطك.",
    ctaPrimary: "انشئ مساحتك (14 يوما)",
    ctaSecondary: "اطلب مكالمة انطلاق",
    videoCta: "شاهد الفيديو",
    trustItems: ["تجربة مجانية 14 يوما", "تفعيل بمرافقة", "تصدير PDF / DOCX / XLSX"],
    heroKpis: [
      { label: "زمن اول وثيقة", value: "< 10 دقائق" },
      { label: "تنبيهات قبل الحد", value: "70% / 90% / 100%" },
      { label: "زمن التواصل", value: "< 24 ساعة" },
    ],
    snapshotLabel: "لقطة مباشرة",
    snapshotStatus: "نشط",
    howTitle: "كيف يعمل",
    howSubtitle: "تدفق واضح من 3 مراحل.",
    steps: [
      { title: "1. انشاء الحساب", description: "تسجيل سريع والدخول مباشرة الى مساحة العمل." },
      { title: "2. تجربة موجهة", description: "14 يوما لاعداد القوالب والعملاء واول وثيقة." },
      { title: "3. التفعيل", description: "مراجعة الحاجة ثم الدفع عبر تحويل او Wafacash ثم التفعيل." },
    ],
    previewTitle: "نظرة على المنتج",
    previewSubtitle: "شاشات عملية للمتابعة اليومية.",
    previews: [
      { title: "لوحة قيادة واضحة", description: "مؤشرات وبيانات اتجاه ووثائق حديثة ودفعات اخيرة." },
      { title: "الوثائق والقوالب", description: "انشاء سريع وتصدير متعدد وصيغ متغيرة ديناميكيا." },
      { title: "تنبيهات تشغيلية", description: "اشعارات قبل الاستحقاق والتأخير وحدود الاستخدام." },
    ],
    mediaTitle: "مرئيات المنتج وفيديوهات قصيرة",
    mediaSubtitle: "لقطات واجهة حقيقية مع فيديوهات سريعة لكل تدفق عمل اساسي.",
    mediaVisuals: [
      {
        title: "لقطة الادارة",
        description: "مؤشرات مالية، اتجاه النشاط، واولويات التحصيل.",
        image: "/marketing/dashboard-visual.svg",
        imageAlt: "معاينة لوحة القيادة DOC_v1",
      },
      {
        title: "تدفق الوثائق",
        description: "عرض الوثائق، الحالات، تصدير القائمة، واجراءات سريعة.",
        image: "/marketing/documents-visual.svg",
        imageAlt: "معاينة صفحة الوثائق DOC_v1",
      },
      {
        title: "التحكم في الاعدادات",
        description: "الفوترة والقوالب والاشعارات وسياسات المنصة.",
        image: "/marketing/settings-visual.svg",
        imageAlt: "معاينة صفحة الاعدادات DOC_v1",
      },
    ],
    mediaVideos: [
      {
        title: "الانطلاق واول فاتورة",
        description: "اعداد المساحة، اضافة عميل ومادة، ثم اصدار اول فاتورة.",
        duration: "2m 10s",
        href: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
      },
      {
        title: "القوالب والمتغيرات الديناميكية",
        description: "استخدام المتغيرات الجاهزة والتصدير PDF/DOCX بشكل ثابت.",
        duration: "1m 45s",
        href: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
      },
      {
        title: "التفعيل واثبات الدفع",
        description: "من التجربة الى ارسال الاثبات ثم مراجعة التفعيل.",
        duration: "1m 30s",
        href: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
      },
    ],
    profileTitle: "الفائدة حسب نوع المستخدم",
    profileSubtitle: "مناسب للمستقلين وSMB والفرق النامية.",
    profiles: [
      { title: "مستقل", description: "فواتير سريعة ومتابعة الدفعات بدون تعقيد." },
      { title: "شركة صغيرة", description: "تدفق ثابت للعرض والفاتورة والتسليم والطلب." },
      { title: "وكالة", description: "قوالب قابلة لاعادة الاستخدام وادارة عدة عملاء." },
      { title: "ادارة مالية", description: "تحكم في الحالات وسجل مركزي واضح." },
    ],
    pricingTitle: "خطط شهرية وسنوية (V1)",
    pricingSubtitle: "تسعير مبني على هدف هامش ربحي 80% (PM-020 مكتمل).",
    billingMonthly: "شهري",
    billingYearly: "سنوي",
    pricingSave: "وفر 20%",
    plans: [
      {
        name: "Starter",
        monthly: "169 درهم / شهر",
        yearly: "1620 درهم / سنة",
        note: "للبداية",
        features: ["وثائق اساسية", "حدود اساسية", "دعم عادي"],
      },
      {
        name: "Pro",
        monthly: "269 درهم / شهر",
        yearly: "2580 درهم / سنة",
        note: "الخطة الاكثر طلبا",
        features: ["حدود اعلى", "تصدير متقدم", "دعم ذو اولوية"],
        highlighted: true,
      },
      {
        name: "Business",
        monthly: "499 درهم / شهر",
        yearly: "4790 درهم / سنة",
        note: "استخدام مكثف",
        features: ["حدود كبيرة", "تعاون فريق", "مرافقة مخصصة"],
      },
    ],
    assistTitle: "بداية بمرافقة",
    assistSubtitle: "اذا كنت غير تقني ففريقنا يساعدك حتى الانطلاق.",
    assistPoints: [
      "مكالمة بعد التسجيل لفهم الاحتياج.",
      "مساعدة في القوالب والاستيراد واول وثيقة.",
      "مراجعة اثبات الدفع ثم تفعيل يدوي.",
    ],
    faqTitle: "اسئلة شائعة",
    faqItems: [
      { q: "ما مدة التجربة؟", a: "14 يوما مع تنبيهات تدريجية قبل القفل." },
      { q: "كيف يتم الدفع حاليا؟", a: "دفع يدوي عبر تحويل بنكي او Wafacash ثم مراجعة داخلية." },
      { q: "ماذا بعد انتهاء التجربة؟", a: "وضع محدود ثم قفل كامل اذا لم يتم التفعيل المدفوع." },
      { q: "هل يوجد دعم للبداية؟", a: "نعم، يوجد دعم من المبيعات والتشغيل." },
    ],
    finalTitle: "جاهز لبدء تدفق الوثائق؟",
    finalSubtitle: "ابدأ مجانا ثم اختر الخطة المناسبة حسب الاستعمال الحقيقي.",
    footer: "DOC_v1 - تشغيل وثائق حديث للاعمال النامية.",
  },
};

export default async function Home() {
  const auth = await getAuthContext();
  if (isDesktopMode()) {
    redirect(auth ? "/dashboard" : "/login");
  }
  if (auth) {
    redirect("/dashboard");
  }

  const { locale } = await getServerI18n();
  const copy = LANDING_COPY[locale];

  return (
    <main className="h-screen overflow-y-auto bg-background text-foreground">
      <LandingViewTracker />
      <div className="relative isolate">
        <div className="landing-orb pointer-events-none absolute inset-x-0 -top-16 h-[420px] bg-[radial-gradient(circle_at_top,hsla(158,72%,38%,0.28),transparent_65%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-64 h-[720px] bg-[radial-gradient(circle_at_12%_18%,hsla(195,82%,55%,0.16),transparent_48%),radial-gradient(circle_at_88%_22%,hsla(158,72%,38%,0.2),transparent_52%),linear-gradient(to_bottom,transparent,hsla(var(--background),0.92)_78%)]" />

        <header className="sticky top-0 z-20 border-b border-border/40 bg-background/74 backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-3 py-1.5 text-xs font-semibold tracking-[0.2em] text-foreground shadow-[0_16px_35px_-28px_rgba(16,185,129,0.55)]"
            >
              <span className="inline-flex h-2 w-2 rounded-full bg-primary" />
              DOC_v1
            </Link>
            <nav className="hidden items-center gap-1 rounded-full border border-border/65 bg-card/75 p-1 text-xs text-muted-foreground md:flex">
              <a href="#how" className="rounded-full px-3 py-1.5 transition hover:bg-background/55 hover:text-foreground">{copy.navHow}</a>
              <a href="#pricing" className="rounded-full px-3 py-1.5 transition hover:bg-background/55 hover:text-foreground">{copy.navPricing}</a>
              <a href="#faq" className="rounded-full px-3 py-1.5 transition hover:bg-background/55 hover:text-foreground">{copy.navFaq}</a>
            </nav>
            <div className="flex flex-wrap items-center justify-end gap-2 sm:flex-nowrap">
              <span className="hidden rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary md:inline-flex">
                {copy.trustItems[0]}
              </span>
              <Link href="/login" className="inline-flex h-9 items-center rounded-full border border-border bg-background/70 px-3 text-[11px] font-semibold text-muted-foreground transition hover:border-primary/30 hover:text-foreground sm:text-xs">
                {copy.navSignIn}
              </Link>
              <SignupStartLink
                sourceSection="header"
                label={copy.ctaPrimary}
                className="inline-flex h-9 items-center rounded-full border border-primary/40 bg-primary/15 px-3 text-[11px] font-semibold text-primary transition hover:border-primary hover:text-primary-foreground sm:text-xs"
              />
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-6xl space-y-14 px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
          <LandingReveal className="relative overflow-hidden rounded-3xl border border-border bg-card/75 p-6 shadow-[0_22px_80px_-48px_rgba(16,185,129,0.6)] sm:p-8">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,hsla(158,72%,40%,0.2),transparent_45%),radial-gradient(circle_at_86%_26%,hsla(198,82%,58%,0.18),transparent_48%)]" />
            <div className="relative grid gap-6 lg:grid-cols-[1.45fr_1fr] lg:gap-8">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-primary">{copy.heroTag}</p>
                <h1 className="mt-3 text-3xl font-semibold leading-tight text-foreground sm:text-4xl">{copy.heroTitle}</h1>
                <p className="mt-3 max-w-3xl text-sm text-muted-foreground sm:text-base">{copy.heroSubtitle}</p>

                <div className="mt-5 flex flex-wrap gap-2">
                  <SignupStartLink
                    sourceSection="hero"
                    label={copy.ctaPrimary}
                    className="inline-flex h-10 items-center rounded-full border border-primary/40 bg-primary/15 px-4 text-sm font-semibold text-primary transition hover:border-primary hover:text-primary-foreground"
                  />
                  <AssistRequestModal
                    locale={locale}
                    sourceSection="hero"
                    triggerLabel={copy.ctaSecondary}
                    triggerClassName="inline-flex h-10 items-center rounded-full border border-border bg-background/70 px-4 text-sm font-semibold text-muted-foreground transition hover:border-primary/30 hover:text-foreground"
                  />
                </div>

                <div className="mt-5 grid gap-2 sm:grid-cols-3">
                  {copy.trustItems.map((item) => (
                    <div key={item} className="rounded-xl border border-border/70 bg-background/45 px-3 py-2 text-xs text-muted-foreground">
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-border/80 bg-background/46 p-4 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{copy.snapshotLabel}</p>
                  <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                    {copy.snapshotStatus}
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {copy.heroKpis.map((kpi) => (
                    <article key={kpi.label} className="rounded-xl border border-primary/20 bg-primary/8 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{kpi.label}</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">{kpi.value}</p>
                    </article>
                  ))}
                </div>
                <div className="mt-3 space-y-2">
                  {copy.steps.map((step) => (
                    <p key={step.title} className="rounded-lg border border-border/70 bg-background/40 px-3 py-2 text-[11px] text-muted-foreground">
                      <span className="font-semibold text-foreground">{step.title}</span>
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </LandingReveal>

          <LandingReveal id="how" className="space-y-4" delayMs={40}>
            <div>
              <h2 className="text-2xl font-semibold text-foreground">{copy.howTitle}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{copy.howSubtitle}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {copy.steps.map((step) => (
                <article key={step.title} className="rounded-xl border border-border bg-card/70 p-4">
                  <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
                  <p className="mt-2 text-xs text-muted-foreground">{step.description}</p>
                </article>
              ))}
            </div>
          </LandingReveal>

          <LandingReveal className="space-y-4" delayMs={80}>
            <div>
              <h2 className="text-2xl font-semibold text-foreground">{copy.previewTitle}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{copy.previewSubtitle}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {copy.previews.map((item) => (
                <article key={item.title} className="rounded-xl border border-border bg-card/70 p-4 transition hover:border-primary/35 hover:bg-card">
                  <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-2 text-xs text-muted-foreground">{item.description}</p>
                </article>
              ))}
            </div>
          </LandingReveal>

          <LandingReveal className="space-y-4" delayMs={100}>
            <div>
              <h2 className="text-2xl font-semibold text-foreground">{copy.mediaTitle}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{copy.mediaSubtitle}</p>
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              {copy.mediaVisuals.map((item) => (
                <article key={item.title} className="overflow-hidden rounded-2xl border border-border bg-card/70">
                  <div className="relative aspect-[16/10] w-full border-b border-border/75 bg-background/45">
                    <Image src={item.image} alt={item.imageAlt} fill sizes="(max-width: 1024px) 100vw, 33vw" className="object-cover" />
                  </div>
                  <div className="space-y-2 p-4">
                    <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                </article>
              ))}
            </div>
            {SHOW_LEARNING_VIDEOS ? (
              <div className="grid gap-3 md:grid-cols-3">
                {copy.mediaVideos.map((video) => (
                  <article key={video.title} className="rounded-xl border border-border bg-card/70 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-foreground">{video.title}</h3>
                      <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{video.duration}</span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{video.description}</p>
                    <a
                      href={video.href}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex h-8 items-center rounded-full border border-primary/35 bg-primary/12 px-3 text-xs font-semibold text-primary transition hover:border-primary hover:text-primary-foreground"
                    >
                      {copy.videoCta}
                    </a>
                  </article>
                ))}
              </div>
            ) : (
              // Temporary: hide learning videos until tutorial content is ready.
              null
            )}
          </LandingReveal>

          <LandingReveal className="space-y-4" delayMs={120}>
            <div>
              <h2 className="text-2xl font-semibold text-foreground">{copy.profileTitle}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{copy.profileSubtitle}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {copy.profiles.map((profile) => (
                <article key={profile.title} className="rounded-xl border border-border bg-card/70 p-4">
                  <h3 className="text-sm font-semibold text-foreground">{profile.title}</h3>
                  <p className="mt-2 text-xs text-muted-foreground">{profile.description}</p>
                </article>
              ))}
            </div>
          </LandingReveal>

          <LandingReveal id="pricing" className="space-y-4" delayMs={160}>
            <div>
              <h2 className="text-2xl font-semibold text-foreground">{copy.pricingTitle}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{copy.pricingSubtitle}</p>
            </div>
            <PricingCards
              plans={copy.plans}
              monthlyLabel={copy.billingMonthly}
              yearlyLabel={copy.billingYearly}
              saveLabel={copy.pricingSave}
            />
          </LandingReveal>

          <LandingReveal id="assist" className="rounded-2xl border border-border bg-card/70 p-5 sm:p-6" delayMs={200}>
            <h2 className="text-2xl font-semibold text-foreground">{copy.assistTitle}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{copy.assistSubtitle}</p>
            <div className="mt-3 space-y-2">
              {copy.assistPoints.map((point) => (
                <p key={point} className="rounded-md border border-border/70 bg-background/35 px-3 py-2 text-xs text-muted-foreground">
                  {point}
                </p>
              ))}
            </div>
            <div className="mt-4">
              <AssistRequestModal
                locale={locale}
                sourceSection="assist"
                triggerLabel={copy.ctaSecondary}
                triggerClassName="inline-flex h-10 items-center rounded-md border border-primary/40 bg-primary/15 px-4 text-sm font-semibold text-primary transition hover:border-primary hover:text-primary-foreground"
              />
            </div>
          </LandingReveal>

          <LandingReveal id="faq" className="space-y-4" delayMs={240}>
            <h2 className="text-2xl font-semibold text-foreground">{copy.faqTitle}</h2>
            <div className="space-y-2">
              {copy.faqItems.map((item) => (
                <details key={item.q} className="rounded-xl border border-border bg-card/70 p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-foreground">{item.q}</summary>
                  <p className="mt-2 text-xs text-muted-foreground">{item.a}</p>
                </details>
              ))}
            </div>
          </LandingReveal>

          <LandingReveal className="rounded-2xl border border-primary/35 bg-primary/10 p-6 text-center" delayMs={280}>
            <h2 className="text-2xl font-semibold text-foreground">{copy.finalTitle}</h2>
            <p className="mx-auto mt-2 max-w-3xl text-sm text-muted-foreground">{copy.finalSubtitle}</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <SignupStartLink
                sourceSection="final-cta"
                label={copy.ctaPrimary}
                className="inline-flex h-10 items-center rounded-md border border-primary/40 bg-primary/15 px-4 text-sm font-semibold text-primary transition hover:border-primary hover:text-primary-foreground"
              />
              <AssistRequestModal
                locale={locale}
                sourceSection="final-cta"
                triggerLabel={copy.ctaSecondary}
                triggerClassName="inline-flex h-10 items-center rounded-md border border-border bg-background/65 px-4 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
              />
            </div>
            <p className="mt-5 text-xs text-muted-foreground">{copy.footer}</p>
          </LandingReveal>
        </div>
      </div>
    </main>
  );
}
