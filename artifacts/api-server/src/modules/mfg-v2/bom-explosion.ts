export interface BomComponentRow {
  id: string;
  parentComponentId: string | null;
  componentItemId: string;
  itemNumber: string | null;
  itemName: string | null;
  sequence: number;
  quantity: string;
  uom: string;
  scrapFactor: string;
  isPhantom: boolean;
  effectiveFrom: string | null;
  effectiveTo: string | null;
}

export interface BomExplosionNode {
  componentId: string;
  componentItemId: string;
  itemNumber: string | null;
  itemName: string | null;
  sequence: number;
  uom: string;
  quantityPerParent: number;
  requiredQuantity: number;
  isPhantom: boolean;
  children: BomExplosionNode[];
}

export interface BomFlatRequirement {
  componentItemId: string;
  itemNumber: string | null;
  itemName: string | null;
  uom: string;
  requiredQuantity: number;
}

export interface BomExplosionResult {
  tree: BomExplosionNode[];
  requirements: BomFlatRequirement[];
}

export function explodeBom(
  components: BomComponentRow[],
  orderQuantity: number,
  asOfDate: Date,
): BomExplosionResult {
  const asOf = asOfDate.toISOString().slice(0, 10);

  const effectiveComponents = components.filter((component) => {
    if (component.effectiveFrom && component.effectiveFrom > asOf) {
      return false;
    }
    if (component.effectiveTo && component.effectiveTo < asOf) {
      return false;
    }
    return true;
  });

  const childrenByParent = new Map<string | null, BomComponentRow[]>();
  for (const component of effectiveComponents) {
    const key = component.parentComponentId;
    const siblings = childrenByParent.get(key) ?? [];
    siblings.push(component);
    childrenByParent.set(key, siblings);
  }

  for (const siblings of childrenByParent.values()) {
    siblings.sort((left, right) => left.sequence - right.sequence);
  }

  const requirementByItem = new Map<string, BomFlatRequirement>();

  function walk(parentId: string | null, requiredParentQty: number): BomExplosionNode[] {
    const children = childrenByParent.get(parentId) ?? [];
    return children.map((component) => {
      const quantityPerParent = Number(component.quantity);
      const scrapFactor = Number(component.scrapFactor ?? "0");
      const requiredQuantity = requiredParentQty * quantityPerParent * (1 + scrapFactor);

      const descendants = walk(component.id, requiredQuantity);

      if (!component.isPhantom) {
        const existing = requirementByItem.get(component.componentItemId);
        if (existing) {
          existing.requiredQuantity += requiredQuantity;
        } else {
          requirementByItem.set(component.componentItemId, {
            componentItemId: component.componentItemId,
            itemNumber: component.itemNumber,
            itemName: component.itemName,
            uom: component.uom,
            requiredQuantity,
          });
        }
      }

      return {
        componentId: component.id,
        componentItemId: component.componentItemId,
        itemNumber: component.itemNumber,
        itemName: component.itemName,
        sequence: component.sequence,
        uom: component.uom,
        quantityPerParent,
        requiredQuantity,
        isPhantom: component.isPhantom,
        children: descendants,
      } satisfies BomExplosionNode;
    });
  }

  const tree = walk(null, orderQuantity);

  return {
    tree,
    requirements: Array.from(requirementByItem.values()).sort((left, right) => {
      const leftKey = left.itemNumber ?? left.componentItemId;
      const rightKey = right.itemNumber ?? right.componentItemId;
      return leftKey.localeCompare(rightKey);
    }),
  };
}