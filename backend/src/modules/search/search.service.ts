import { BaseService } from '../../core/services/base.service.js';
import { ISearchRepository, searchRepository } from './search.repository.js';
import { PERMISSIONS } from '../rbac/rbac.constants.js';
import {
  ISearchResponse,
  ISearchGroup,
  ISearchResultItem,
  IQuickAction,
  SearchCategory,
  QuerySearchDto
} from './search.types.js';

export interface IActorSearchContext {
  userId: string;
  roles: string[];
  permissions: string[];
}

export class SearchService extends BaseService {
  constructor(private readonly repo: ISearchRepository = searchRepository) {
    super('SearchService');
  }

  private escapeRegex(str: string): RegExp {
    const escaped = str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(escaped, 'i');
  }

  private hasPermission(actor: IActorSearchContext, permission: string): boolean {
    const roles = actor.roles || [];
    if (roles.includes('ADMIN') || roles.includes('PLANT_MANAGER')) return true;
    if (
      roles.includes('FINANCE_CONTROLLER') &&
      [
        PERMISSIONS.BILLING_INVOICE_VIEW,
        PERMISSIONS.FINANCE_ACCOUNT_VIEW,
        PERMISSIONS.BILLING_AGING_VIEW
      ].includes(permission as any)
    ) {
      return true;
    }
    if (
      (roles.includes('QUALITY_MANAGER') || roles.includes('QUALITY_INSPECTOR')) &&
      [PERMISSIONS.QUALITY_INSPECTION_VIEW, PERMISSIONS.QUALITY_INSPECTION_RECORD].includes(permission as any)
    ) {
      return true;
    }
    if (
      (roles.includes('FURNACE_OPERATOR') || roles.includes('PRODUCTION_SUPERVISOR')) &&
      [
        PERMISSIONS.PRODUCTION_JOB_VIEW,
        PERMISSIONS.PRODUCTION_JOB_CREATE,
        PERMISSIONS.MACHINES_FURNACE_VIEW,
        PERMISSIONS.INVENTORY_HEAT_LOT_VIEW,
        PERMISSIONS.INVENTORY_ITEM_VIEW
      ].includes(permission as any)
    ) {
      return true;
    }
    if (
      roles.includes('MAINTENANCE_TECH') &&
      [PERMISSIONS.MACHINES_FURNACE_VIEW, PERMISSIONS.MAINTENANCE_WORKORDER_VIEW].includes(permission as any)
    ) {
      return true;
    }
    return (actor.permissions || []).includes(permission);
  }

  public async search(
    tenantId: string,
    actor: IActorSearchContext,
    dto: QuerySearchDto
  ): Promise<ISearchResponse> {
    const query = dto.q.trim();
    const category = dto.category || 'ALL';
    const limit = dto.limit || 10;
    const regex = this.escapeRegex(query);

    const groups: ISearchGroup[] = [];
    const queryPromises: Promise<void>[] = [];

    // 1. Production Jobs
    if (
      (category === 'ALL' || category === 'JOBS') &&
      this.hasPermission(actor, PERMISSIONS.PRODUCTION_JOB_VIEW)
    ) {
      queryPromises.push(
        this.repo.searchJobs(tenantId, regex, limit).then((jobs) => {
          if (jobs.length > 0) {
            groups.push({
              category: 'JOBS',
              label: 'Production Work Orders & Batches',
              totalMatches: jobs.length,
              items: jobs.map((j: any) => ({
                id: j._id ? j._id.toString() : j.id,
                category: 'JOBS',
                title: `${j.jobNumber} — ${j.customer?.customerName || 'Standard Job'}`,
                subtitle: `Alloy: ${j.item?.itemCode || 'Alloy'} • Stage: ${j.currentStage || j.status || 'SCHEDULED'}`,
                referenceCode: j.jobNumber,
                status: j.status,
                actionUrl: `/production-jobs/${j._id ? j._id.toString() : j.id}`,
                metadata: {
                  plannedQuantity: j.quantity?.targetQuantity,
                  completedQuantity: j.quantity?.completedQuantity
                }
              }))
            });
          }
        })
      );
    }

    // 2. Customers
    if (
      (category === 'ALL' || category === 'CUSTOMERS') &&
      this.hasPermission(actor, PERMISSIONS.CUSTOMER_VIEW)
    ) {
      queryPromises.push(
        this.repo.searchCustomers(tenantId, regex, limit).then((customers) => {
          if (customers.length > 0) {
            groups.push({
              category: 'CUSTOMERS',
              label: 'Customer Accounts & Partners',
              totalMatches: customers.length,
              items: customers.map((c: any) => ({
                id: c._id ? c._id.toString() : c.id,
                category: 'CUSTOMERS',
                title: `${c.name} (${c.customerCode})`,
                subtitle: `Contact: ${c.contactPerson || c.email || 'N/A'} • Payment Terms: ${c.paymentTerms || 'NET30'}`,
                referenceCode: c.customerCode,
                status: c.status,
                actionUrl: `/customers/${c._id ? c._id.toString() : c.id}`,
                metadata: { email: c.email, phone: c.phone }
              }))
            });
          }
        })
      );
    }

    // 3. Materials / Items
    if (
      (category === 'ALL' || category === 'MATERIALS') &&
      this.hasPermission(actor, PERMISSIONS.INVENTORY_ITEM_VIEW)
    ) {
      queryPromises.push(
        this.repo.searchMaterials(tenantId, regex, limit).then((items) => {
          if (items.length > 0) {
            groups.push({
              category: 'MATERIALS',
              label: 'Raw Materials & Parts',
              totalMatches: items.length,
              items: items.map((i: any) => ({
                id: i._id ? i._id.toString() : i.id,
                category: 'MATERIALS',
                title: `${i.itemCode} — ${i.name}`,
                subtitle: `Grade: ${i.materialGrade || 'Standard'} • UOM: ${i.uom || 'KG'} • Std Cost: $${i.standardCost || 0}`,
                referenceCode: i.itemCode,
                status: i.status,
                actionUrl: `/inventory/items/${i._id ? i._id.toString() : i.id}`,
                metadata: { safetyStock: i.safetyStock }
              }))
            });
          }
        })
      );
    }

    // 4. Heat Lots
    if (
      (category === 'ALL' || category === 'HEAT_LOTS') &&
      this.hasPermission(actor, PERMISSIONS.INVENTORY_HEAT_LOT_VIEW)
    ) {
      queryPromises.push(
        this.repo.searchHeatLots(tenantId, regex, limit).then((lots) => {
          if (lots.length > 0) {
            groups.push({
              category: 'HEAT_LOTS',
              label: 'Heat Lots & Traceability',
              totalMatches: lots.length,
              items: lots.map((l: any) => ({
                id: l._id ? l._id.toString() : l.id,
                category: 'HEAT_LOTS',
                title: `Heat-Lot ${l.heatLotNumber}`,
                subtitle: `Supplier Heat: ${l.supplierHeatNumber || 'N/A'} • Grade: ${l.materialGrade || 'Standard'}`,
                referenceCode: l.heatLotNumber,
                status: l.status,
                actionUrl: `/heat-lots/${l._id ? l._id.toString() : l.id}`,
                metadata: { quantityOnHand: l.quantityOnHand, isQuarantined: l.isQuarantined }
              }))
            });
          }
        })
      );
    }

    // 5. Machines / Furnaces
    if (
      (category === 'ALL' || category === 'MACHINES') &&
      this.hasPermission(actor, PERMISSIONS.MACHINES_FURNACE_VIEW)
    ) {
      queryPromises.push(
        this.repo.searchMachines(tenantId, regex, limit).then((machines) => {
          if (machines.length > 0) {
            groups.push({
              category: 'MACHINES',
              label: 'Furnaces & Equipment Fleet',
              totalMatches: machines.length,
              items: machines.map((m: any) => ({
                id: m._id ? m._id.toString() : m.id,
                category: 'MACHINES',
                title: `${m.machineCode} (${m.name})`,
                subtitle: `Type: ${m.type} • Bay: ${m.location?.bay || 'Bay 1'} • S/N: ${m.serialNumber || 'N/A'}`,
                referenceCode: m.machineCode,
                status: m.status,
                actionUrl: `/machines/${m._id ? m._id.toString() : m.id}`,
                metadata: { type: m.type, location: m.location }
              }))
            });
          }
        })
      );
    }

    // 6. Quality Inspections
    if (
      (category === 'ALL' || category === 'INSPECTIONS') &&
      this.hasPermission(actor, PERMISSIONS.QUALITY_INSPECTION_VIEW)
    ) {
      queryPromises.push(
        this.repo.searchInspections(tenantId, regex, limit).then((inspections) => {
          if (inspections.length > 0) {
            groups.push({
              category: 'INSPECTIONS',
              label: 'Quality Lab & Inspections',
              totalMatches: inspections.length,
              items: inspections.map((i: any) => ({
                id: i._id ? i._id.toString() : i.id,
                category: 'INSPECTIONS',
                title: `${i.inspectionNumber} (Job ${i.jobNumber})`,
                subtitle: `Disposition: ${i.disposition || i.overallStatus || 'PENDING'} • Specimen: ${i.heatLotNumber || 'N/A'}`,
                referenceCode: i.inspectionNumber,
                status: i.overallStatus,
                actionUrl: `/quality/inspections/${i._id ? i._id.toString() : i.id}`,
                metadata: { disposition: i.disposition }
              }))
            });
          }
        })
      );
    }

    // 7. Non-Conformance Reports (NCRs)
    if (
      (category === 'ALL' || category === 'NCRS') &&
      this.hasPermission(actor, PERMISSIONS.QUALITY_INSPECTION_VIEW)
    ) {
      queryPromises.push(
        this.repo.searchNcrs(tenantId, regex, limit).then((ncrs) => {
          if (ncrs.length > 0) {
            groups.push({
              category: 'NCRS',
              label: 'Quality NCRs & CAPAs',
              totalMatches: ncrs.length,
              items: ncrs.map((n: any) => ({
                id: n._id ? n._id.toString() : n.id,
                category: 'NCRS',
                title: `${n.ncrNumber}: ${n.title}`,
                subtitle: `Severity: ${n.severity || 'MAJOR'} • Job: ${n.jobNumber || 'N/A'} • Defect: ${n.defectCategory || 'Standard'}`,
                referenceCode: n.ncrNumber,
                status: n.status,
                actionUrl: `/quality/ncrs/${n._id ? n._id.toString() : n.id}`,
                metadata: { severity: n.severity, quarantinedQuantity: n.quarantinedQuantity }
              }))
            });
          }
        })
      );
    }

    // 8. Dispatches
    if (
      (category === 'ALL' || category === 'DISPATCHES') &&
      this.hasPermission(actor, PERMISSIONS.DISPATCH_DELIVERY_VIEW)
    ) {
      queryPromises.push(
        this.repo.searchDispatches(tenantId, regex, limit).then((dispatches) => {
          if (dispatches.length > 0) {
            groups.push({
              category: 'DISPATCHES',
              label: 'Finished Goods & Dispatches',
              totalMatches: dispatches.length,
              items: dispatches.map((d: any) => ({
                id: d._id ? d._id.toString() : d.id,
                category: 'DISPATCHES',
                title: `${d.dispatchNumber} — ${d.customer?.customerName || 'Customer'}`,
                subtitle: `Carrier: ${d.carrier?.carrierName || 'Internal'} • Vehicle: ${d.carrier?.vehicleNumber || 'N/A'}`,
                referenceCode: d.dispatchNumber,
                status: d.status,
                actionUrl: `/dispatches/${d._id ? d._id.toString() : d.id}`,
                metadata: { carrier: d.carrier }
              }))
            });
          }
        })
      );
    }

    // 9. Invoices (Permission-Scoped)
    if (
      (category === 'ALL' || category === 'INVOICES') &&
      (this.hasPermission(actor, PERMISSIONS.BILLING_INVOICE_VIEW) ||
        this.hasPermission(actor, PERMISSIONS.FINANCE_ACCOUNT_VIEW))
    ) {
      queryPromises.push(
        this.repo.searchInvoices(tenantId, regex, limit).then((invoices) => {
          if (invoices.length > 0) {
            groups.push({
              category: 'INVOICES',
              label: 'Customer Invoices & Billing',
              totalMatches: invoices.length,
              items: invoices.map((inv: any) => ({
                id: inv._id ? inv._id.toString() : inv.id,
                category: 'INVOICES',
                title: `Invoice ${inv.invoiceNumber} (${inv.customerCode || 'Customer'})`,
                subtitle: `Amount: $${(inv.totalAmount || 0).toFixed(2)} • Due: ${inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : 'N/A'}`,
                referenceCode: inv.invoiceNumber,
                status: inv.paymentStatus || inv.status,
                actionUrl: `/billing/invoices/${inv._id ? inv._id.toString() : inv.id}`,
                metadata: { totalAmount: inv.totalAmount, outstandingAmount: inv.outstandingAmount }
              }))
            });
          }
        })
      );
    }

    // Execute all queries in parallel
    await Promise.all(queryPromises);

    const totalResults = groups.reduce((sum, g) => sum + g.totalMatches, 0);
    const quickActions = this.getQuickActionsForActor(actor);
    const suggestions = this.getSuggestionsForQuery(query);

    return {
      query,
      category,
      totalResults,
      groups,
      suggestions,
      quickActions
    };
  }

  public getQuickActionsForActor(actor: IActorSearchContext): IQuickAction[] {
    const actions: IQuickAction[] = [
      {
        id: 'act_command_center',
        title: 'Manufacturing Command Center',
        description: 'Open live shop floor telemetry and operational pulse',
        shortcut: 'G D',
        category: 'NAVIGATION',
        actionUrl: '/dashboard',
        icon: 'LayoutDashboard'
      },
      {
        id: 'act_new_job',
        title: 'Create Production Work Order',
        description: 'Schedule a new heat-treatment batch on a furnace',
        shortcut: 'N J',
        category: 'PRODUCTION',
        requiredPermission: PERMISSIONS.PRODUCTION_JOB_CREATE,
        actionUrl: '/production-jobs/create',
        icon: 'Flame'
      },
      {
        id: 'act_record_inspection',
        title: 'Record QC Hardness Survey',
        description: 'Log metallurgical test specimen hardness & case depth',
        shortcut: 'N Q',
        category: 'QUALITY',
        requiredPermission: PERMISSIONS.QUALITY_INSPECTION_RECORD,
        actionUrl: '/quality/inspections/create',
        icon: 'ShieldCheck'
      },
      {
        id: 'act_raise_ncr',
        title: 'Raise Non-Conformance Report',
        description: 'Quarantine out-of-spec lot and initiate disposition',
        shortcut: 'N N',
        category: 'QUALITY',
        requiredPermission: PERMISSIONS.QUALITY_INSPECTION_RECORD,
        actionUrl: '/quality/ncrs/create',
        icon: 'AlertTriangle'
      },
      {
        id: 'act_view_fleet',
        title: 'Furnace Fleet Status',
        description: 'Inspect live temperatures, atmospheres & pyrometry',
        shortcut: 'G F',
        category: 'EQUIPMENT',
        requiredPermission: PERMISSIONS.MACHINES_FURNACE_VIEW,
        actionUrl: '/machines',
        icon: 'Cpu'
      },
      {
        id: 'act_create_dispatch',
        title: 'Create Dispatch Gate Pass',
        description: 'Generate consignment manifest & shipping delivery pass',
        shortcut: 'N D',
        category: 'DISPATCH',
        requiredPermission: PERMISSIONS.DISPATCH_DELIVERY_CREATE,
        actionUrl: '/dispatches/create',
        icon: 'Truck'
      }
    ];

    // Add Finance actions for authorized users
    if (
      this.hasPermission(actor, PERMISSIONS.FINANCE_ACCOUNT_VIEW) ||
      this.hasPermission(actor, PERMISSIONS.BILLING_INVOICE_VIEW)
    ) {
      actions.push({
        id: 'act_view_receivables',
        title: 'Accounts Receivable & Aging',
        description: 'Inspect customer billing aging and outstanding ledger',
        shortcut: 'G A',
        category: 'FINANCE',
        requiredPermission: PERMISSIONS.BILLING_AGING_VIEW,
        actionUrl: '/billing/aging',
        icon: 'DollarSign'
      });
    }

    return actions.filter((act) => !act.requiredPermission || this.hasPermission(actor, act.requiredPermission));
  }

  public getSuggestionsForQuery(query: string): string[] {
    const commonTerms = [
      'JOB-202608',
      'FURNACE-VAC-01',
      'FURNACE-PIT-01',
      'AISI 4340',
      'Inconel 718',
      '8620 Alloy',
      'NCR-202608',
      'DSP-202608',
      'AMS 2750G',
      'AeroDynamics Corp'
    ];

    if (!query) return commonTerms.slice(0, 5);
    return commonTerms.filter((t) => t.toLowerCase().includes(query.toLowerCase())).slice(0, 5);
  }
}

export const searchService = new SearchService();
