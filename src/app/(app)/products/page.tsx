import { prisma } from "@/lib/db";
import { requireAuthContext } from "@/features/auth/lib/session";
import { ProductsView } from "@/features/products/components/products-view";
import { getServerI18n } from "@/i18n/server";

export default async function ProductsPage() {
  const auth = await requireAuthContext();
  const { t } = await getServerI18n();
  const companyId = auth.company.id;
  const [products, latestDocument] = await Promise.all([
    prisma.product.findMany({
      where: { companyId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        sku: true,
        name: true,
        description: true,
        unit: true,
        priceHT: true,
        vatRate: true,
        isActive: true,
        updatedAt: true,
      },
    }),
    prisma.document.findFirst({
      where: { companyId },
      orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
      select: { currency: true },
    }),
  ]);
  const currency = latestDocument?.currency || "MAD";

  const productIds = products.map((product) => product.id);
  const lineItems = productIds.length
    ? await prisma.documentLineItem.findMany({
        where: {
          companyId,
          productId: { in: productIds },
        },
        select: {
          productId: true,
          documentId: true,
          quantity: true,
          lineSubtotalHT: true,
        },
      })
    : [];

  const metricsByProduct = new Map<
    string,
    {
      documentsCount: number;
      lineItemsCount: number;
      soldQuantity: number;
      revenueHT: number;
    }
  >();
  const docsByProduct = new Map<string, Set<string>>();

  for (const line of lineItems) {
    if (!line.productId) {
      continue;
    }
    const current = metricsByProduct.get(line.productId) || {
      documentsCount: 0,
      lineItemsCount: 0,
      soldQuantity: 0,
      revenueHT: 0,
    };
    const docsSet = docsByProduct.get(line.productId) || new Set<string>();
    docsSet.add(line.documentId);
    docsByProduct.set(line.productId, docsSet);
    metricsByProduct.set(line.productId, {
      documentsCount: docsSet.size,
      lineItemsCount: current.lineItemsCount + 1,
      soldQuantity: current.soldQuantity + Number(line.quantity || 0),
      revenueHT: current.revenueHT + Number(line.lineSubtotalHT || 0),
    });
  }

  const rows = products.map((product) => ({
    id: product.id,
    sku: product.sku,
    name: product.name,
    description: product.description,
    unit: product.unit,
    priceHT: Number(product.priceHT),
    vatRate: Number(product.vatRate),
    isActive: product.isActive,
    documentsCount: metricsByProduct.get(product.id)?.documentsCount || 0,
    lineItemsCount: metricsByProduct.get(product.id)?.lineItemsCount || 0,
    soldQuantity: metricsByProduct.get(product.id)?.soldQuantity || 0,
    revenueHT: metricsByProduct.get(product.id)?.revenueHT || 0,
    updatedAt: product.updatedAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t("products.page.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("products.page.subtitle")}
        </p>
      </header>
      <ProductsView products={rows} currency={currency} />
    </div>
  );
}
