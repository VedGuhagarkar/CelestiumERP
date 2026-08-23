import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

// Load development environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.development') });

import { connectDatabase, disconnectDatabase } from '../config/database.config.js';
import { roleRepository } from '../modules/rbac/role.repository.js';
import { UserModel } from '../modules/auth/user.model.js';
import { CustomerModel } from '../modules/customer/customer.model.js';
import { ItemModel } from '../modules/item/item.model.js';
import { RecipeModel } from '../modules/recipe/recipe.model.js';
import { SpecificationModel } from '../modules/specification/specification.model.js';
import { HeatLotModel } from '../modules/traceability/heat-lot.model.js';
import { MachineModel } from '../modules/machine/machine.model.js';
import { ProductionJobModel } from '../modules/production-job/production-job.model.js';
import { QualityInspectionModel } from '../modules/quality-inspection/quality-inspection.model.js';
import { NonConformanceReportModel } from '../modules/ncr-capa/ncr-capa.model.js';
import { WarehouseModel } from '../modules/warehouse/warehouse.model.js';
import { DispatchConsignmentModel } from '../modules/dispatch/dispatch.model.js';
import { Invoice } from '../modules/billing/billing.model.js';
import { JobCost } from '../modules/costing/costing.model.js';
import { MaintenanceWorkOrderModel } from '../modules/maintenance/maintenance.model.js';
import { Notification } from '../modules/notification/notification.model.js';
import { AuditLogModel } from '../modules/audit/audit-log.model.js';
import { ShiftModel } from '../modules/attendance/attendance.model.js';

const TENANT_ID = process.env.DEFAULT_TENANT_ID || 'tenant_default_001';

export async function seedSampleDatabase() {
  console.log(`\n======================================================`);
  console.log(`🌱 ASTRALIS ERP — HIGH-FREQUENCY SAMPLE DATABASE SEEDER`);
  console.log(`🎯 Target Tenant: ${TENANT_ID}`);
  console.log(`======================================================\n`);

  try {
    await connectDatabase();
    console.log('✅ Connected to MongoDB');

    // 1. Clear existing tenant data
    console.log('🧹 Purging previous sample records for tenant...');
    await Promise.all([
      UserModel.deleteMany({ tenantId: TENANT_ID }),
      CustomerModel.deleteMany({ tenantId: TENANT_ID }),
      ItemModel.deleteMany({ tenantId: TENANT_ID }),
      RecipeModel.deleteMany({ tenantId: TENANT_ID }),
      SpecificationModel.deleteMany({ tenantId: TENANT_ID }),
      HeatLotModel.deleteMany({ tenantId: TENANT_ID }),
      MachineModel.deleteMany({ tenantId: TENANT_ID }),
      ProductionJobModel.deleteMany({ tenantId: TENANT_ID }),
      QualityInspectionModel.deleteMany({ tenantId: TENANT_ID }),
      NonConformanceReportModel.deleteMany({ tenantId: TENANT_ID }),
      WarehouseModel.deleteMany({ tenantId: TENANT_ID }),
      DispatchConsignmentModel.deleteMany({ tenantId: TENANT_ID }),
      Invoice.deleteMany({ tenantId: TENANT_ID }),
      JobCost.deleteMany({ tenantId: TENANT_ID }),
      MaintenanceWorkOrderModel.deleteMany({ tenantId: TENANT_ID }),
      Notification.deleteMany({ tenantId: TENANT_ID }),
      AuditLogModel.deleteMany({ tenantId: TENANT_ID }),
      ShiftModel.deleteMany({ tenantId: TENANT_ID })
    ]);

    // 2. Seed RBAC Factory Roles
    console.log('🛡️ Seeding standard factory roles & permissions...');
    await roleRepository.seedDefaultRolesForTenant(TENANT_ID);

    // 3. Seed Personas & User Accounts
    console.log('👤 Seeding factory staff personas & accounts...');
    const passwordHash = await bcrypt.hash('Password123!', 10);

    const users = await UserModel.create([
      {
        tenantId: TENANT_ID,
        username: 'admin',
        email: 'admin@astralis.internal',
        passwordHash,
        firstName: 'Arthur',
        lastName: 'Vance',
        roles: ['ADMIN'],
        status: 'active'
      },
      {
        tenantId: TENANT_ID,
        username: 'plant_mgr',
        email: 'manager@astralis.internal',
        passwordHash,
        firstName: 'Marcus',
        lastName: 'Sterling',
        roles: ['PLANT_MANAGER'],
        status: 'active'
      },
      {
        tenantId: TENANT_ID,
        username: 'supervisor',
        email: 'supervisor@astralis.internal',
        passwordHash,
        firstName: 'Elena',
        lastName: 'Rostova',
        roles: ['PRODUCTION_SUPERVISOR'],
        status: 'active'
      },
      {
        tenantId: TENANT_ID,
        username: 'operator',
        email: 'operator@astralis.internal',
        passwordHash,
        firstName: 'Dmitri',
        lastName: 'Volkov',
        roles: ['FURNACE_OPERATOR'],
        status: 'active'
      },
      {
        tenantId: TENANT_ID,
        username: 'qc_mgr',
        email: 'qc@astralis.internal',
        passwordHash,
        firstName: 'Dr. Sarah',
        lastName: 'Chen',
        roles: ['QUALITY_MANAGER'],
        status: 'active'
      },
      {
        tenantId: TENANT_ID,
        username: 'lab_tech',
        email: 'lab@astralis.internal',
        passwordHash,
        firstName: 'Rajesh',
        lastName: 'Kulkarni',
        roles: ['METALLURGICAL_LAB_TECH'],
        status: 'active'
      },
      {
        tenantId: TENANT_ID,
        username: 'maint_tech',
        email: 'maintenance@astralis.internal',
        passwordHash,
        firstName: 'Viktor',
        lastName: 'Kovac',
        roles: ['MAINTENANCE_TECH'],
        status: 'active'
      },
      {
        tenantId: TENANT_ID,
        username: 'storekeeper',
        email: 'stores@astralis.internal',
        passwordHash,
        firstName: 'Hassan',
        lastName: 'Ali',
        roles: ['INVENTORY_STOREKEEPER'],
        status: 'active'
      },
      {
        tenantId: TENANT_ID,
        username: 'dispatch',
        email: 'dispatch@astralis.internal',
        passwordHash,
        firstName: 'Carlos',
        lastName: 'Mendoza',
        roles: ['DISPATCH_OFFICER'],
        status: 'active'
      },
      {
        tenantId: TENANT_ID,
        username: 'finance',
        email: 'finance@astralis.internal',
        passwordHash,
        firstName: 'Clara',
        lastName: 'Oswald',
        roles: ['FINANCE_CONTROLLER'],
        status: 'active'
      }
    ]);
    console.log(`   ➔ Created ${users.length} user accounts with password: Password123!`);

    // 4. Seed Customers
    console.log('🏢 Seeding customer registry...');
    const customers = await CustomerModel.create([
      {
        tenantId: TENANT_ID,
        customerCode: 'CUST-AERO-001',
        companyName: 'AeroDynamics Propulsion Systems Corp',
        tradeName: 'AeroDynamics',
        industrySegment: 'Aerospace',
        qualityStatus: 'approved',
        contacts: [
          {
            name: 'David Miller',
            email: 'dmiller@aerodynamics.com',
            phone: '+1-555-432-8899',
            designation: 'Procurement Director',
            isPrimary: true
          }
        ],
        billingAddress: {
          plantName: 'Northwest Aerospace Complex',
          street: '100 Aerospace Blvd',
          city: 'Seattle',
          state: 'WA',
          postalCode: '98101',
          country: 'USA'
        },
        shippingAddresses: [
          {
            plantName: 'Northwest Aerospace Complex Dock 4',
            street: '100 Aerospace Blvd',
            city: 'Seattle',
            state: 'WA',
            postalCode: '98101',
            country: 'USA'
          }
        ],
        paymentTerms: 'Net 30'
      },
      {
        tenantId: TENANT_ID,
        customerCode: 'CUST-TITAN-002',
        companyName: 'Titan Precision Defense Technologies',
        tradeName: 'Titan Defense',
        industrySegment: 'Defense',
        qualityStatus: 'approved',
        contacts: [
          {
            name: 'Col. Robert Briggs',
            email: 'rbriggs@titandefense.mil',
            phone: '+1-555-902-1144',
            designation: 'Material Readiness Lead',
            isPrimary: true
          }
        ],
        billingAddress: {
          street: '500 Defense Parkway',
          city: 'Huntsville',
          state: 'AL',
          postalCode: '35801',
          country: 'USA'
        },
        paymentTerms: 'Net 45'
      },
      {
        tenantId: TENANT_ID,
        customerCode: 'CUST-APEX-003',
        companyName: 'Apex Automotive High-Performance Drivetrains',
        tradeName: 'Apex Drivetrains',
        industrySegment: 'Automotive',
        qualityStatus: 'approved',
        contacts: [
          {
            name: 'Gianni Romano',
            email: 'gromano@apexauto.com',
            phone: '+1-555-773-2001',
            designation: 'Plant Metallurgist',
            isPrimary: true
          }
        ],
        billingAddress: {
          street: '400 Industrial Way',
          city: 'Detroit',
          state: 'MI',
          postalCode: '48201',
          country: 'USA'
        },
        paymentTerms: 'Net 30'
      },
      {
        tenantId: TENANT_ID,
        customerCode: 'CUST-ORBIT-004',
        companyName: 'Orbital Spacecraft Launch Systems',
        tradeName: 'Orbital Space',
        industrySegment: 'Aerospace',
        qualityStatus: 'approved',
        contacts: [
          {
            name: 'Hannah Scott',
            email: 'hscott@orbitalspace.io',
            phone: '+1-555-881-3400',
            designation: 'Flight Structures Specialist',
            isPrimary: true
          }
        ],
        billingAddress: {
          street: '1200 Cape Canaveral Rd',
          city: 'Titusville',
          state: 'FL',
          postalCode: '32780',
          country: 'USA'
        },
        paymentTerms: 'Net 15'
      }
    ]);

    // 5. Seed Items & Materials
    console.log('📦 Seeding materials catalog & parts...');
    const items = await ItemModel.create([
      {
        tenantId: TENANT_ID,
        itemCode: 'BAR-4340-50MM',
        name: 'AISI 4340 Alloy Steel Round Bar 50mm',
        description: 'High-tensile alloy steel for aircraft structural and shaft applications',
        materialGrade: 'AISI 4340',
        category: 'RAW_MATERIAL',
        uom: 'KG',
        minStockLevel: 500,
        reorderPoint: 800,
        safetyStock: 500,
        currentStock: 4200,
        allocatedStock: 800
      },
      {
        tenantId: TENANT_ID,
        itemCode: 'BAR-8620-75MM',
        name: 'AISI 8620 Carburizing Steel Bar 75mm',
        description: 'Nickel-chromium-molybdenum case-hardening alloy steel for heavy gears',
        materialGrade: 'AISI 8620',
        category: 'RAW_MATERIAL',
        uom: 'KG',
        minStockLevel: 400,
        reorderPoint: 700,
        safetyStock: 400,
        currentStock: 6100,
        allocatedStock: 1400
      },
      {
        tenantId: TENANT_ID,
        itemCode: 'INCONEL-718-ROD',
        name: 'Inconel 718 High-Temperature Superalloy Rod 40mm',
        description: 'Precipitation-hardenable nickel-chromium superalloy for jet engines',
        materialGrade: 'Inconel 718',
        category: 'RAW_MATERIAL',
        uom: 'KG',
        minStockLevel: 100,
        reorderPoint: 250,
        safetyStock: 100,
        currentStock: 1850,
        allocatedStock: 150
      },
      {
        tenantId: TENANT_ID,
        itemCode: 'PART-SHAFT-4340',
        name: 'Aero Turbine Main Rotor Shaft',
        description: 'Precision-machined vacuum-hardened turbine rotor shaft',
        materialGrade: 'AISI 4340',
        category: 'FINISHED_TREATED_GOODS',
        uom: 'PCS',
        minStockLevel: 20,
        reorderPoint: 50,
        safetyStock: 20,
        currentStock: 120,
        allocatedStock: 0
      },
      {
        tenantId: TENANT_ID,
        itemCode: 'PART-PINION-8620',
        name: 'Heavy Transmission Pinion Gear',
        description: 'Case-carburized high-torque planetary pinion gear',
        materialGrade: 'AISI 8620',
        category: 'FINISHED_TREATED_GOODS',
        uom: 'PCS',
        minStockLevel: 30,
        reorderPoint: 80,
        safetyStock: 30,
        currentStock: 300,
        allocatedStock: 0
      }
    ]);

    // 6. Seed Heat Lots & Material Traceability
    console.log('🔬 Seeding heat lots & metallurgical certificates...');
    const heatLots = await HeatLotModel.create([
      {
        tenantId: TENANT_ID,
        heatLotNumber: 'HL-4340-2026A',
        itemId: items[0]._id.toString(),
        itemCode: items[0].itemCode,
        materialGrade: 'AISI 4340',
        supplierHeatNumber: 'HEAT-TIMKEN-99482',
        supplierName: 'TimkenSteel Corporation',
        mtrNumber: 'COA-TK-2026-99482',
        receivedDate: new Date(Date.now() - 30 * 86400000),
        receivedQuantity: 5000,
        uom: 'KG',
        currentQuantity: 4200,
        allocatedQuantity: 800,
        consumedQuantity: 0,
        storageLocation: 'Bay 1 - Rack A3',
        status: 'RELEASED'
      },
      {
        tenantId: TENANT_ID,
        heatLotNumber: 'HL-8620-2026B',
        itemId: items[1]._id.toString(),
        itemCode: items[1].itemCode,
        materialGrade: 'AISI 8620',
        supplierHeatNumber: 'HEAT-ARCELOR-88319',
        supplierName: 'ArcelorMittal Global Special Steels',
        mtrNumber: 'COA-AM-2026-88319',
        receivedDate: new Date(Date.now() - 40 * 86400000),
        receivedQuantity: 7500,
        uom: 'KG',
        currentQuantity: 6100,
        allocatedQuantity: 1400,
        consumedQuantity: 0,
        storageLocation: 'Bay 2 - Rack B1',
        status: 'RELEASED'
      },
      {
        tenantId: TENANT_ID,
        heatLotNumber: 'HL-718-2026C',
        itemId: items[2]._id.toString(),
        itemCode: items[2].itemCode,
        materialGrade: 'Inconel 718',
        supplierHeatNumber: 'HEAT-SPECMET-77104',
        supplierName: 'Special Metals Corporation',
        mtrNumber: 'COA-SMC-2026-77104',
        receivedDate: new Date(Date.now() - 15 * 86400000),
        receivedQuantity: 2000,
        uom: 'KG',
        currentQuantity: 1850,
        allocatedQuantity: 150,
        consumedQuantity: 0,
        storageLocation: 'Bay 1 - Vault S2',
        status: 'RELEASED'
      }
    ]);

    // 7. Seed Engineering Specifications & Process Recipes
    console.log('📜 Seeding specifications & recipes...');
    const specifications = await SpecificationModel.create([
      {
        tenantId: TENANT_ID,
        specCode: 'SPEC-AMS-2759-4340',
        revision: 1,
        title: 'AMS 2759/1 Heat Treatment of Low-Alloy Steel Parts (58-62 HRC)',
        description: 'Aerospace structural specification for vacuum hardening and tempering',
        customerCode: customers[0].customerCode,
        applicableMaterialGrades: ['AISI 4340'],
        processFamily: 'NEUTRAL_HARDENING',
        surfaceHardness: {
          min: 58.0,
          max: 62.0,
          scale: 'HRC',
          testMethodReference: 'ASTM E18'
        },
        customerAcceptance: {
          samplingPlan: 'ANSI/ASQ Z1.4 Level II',
          cocRequired: true,
          testStandardReferences: ['AMS 2759/1', 'ASTM E18']
        },
        authorId: users[4]._id.toString(),
        status: 'APPROVED'
      },
      {
        tenantId: TENANT_ID,
        specCode: 'SPEC-CQI-9-CARB-8620',
        revision: 1,
        title: 'CQI-9 Case Hardening of Pinion Gears (0.8-1.2mm ECD)',
        description: 'Automotive powertrain case hardening specification with verified case depth',
        customerCode: customers[2].customerCode,
        applicableMaterialGrades: ['AISI 8620'],
        processFamily: 'CARBURIZING',
        surfaceHardness: {
          min: 60.0,
          max: 64.0,
          scale: 'HRC',
          testMethodReference: 'ASTM E18'
        },
        caseDepth: {
          effectiveCaseDepthMinMm: 0.8,
          effectiveCaseDepthMaxMm: 1.2,
          caseDepthCutoffHRC: 50.0
        },
        customerAcceptance: {
          samplingPlan: 'CQI-9 Table 3.1',
          cocRequired: true,
          testStandardReferences: ['CQI-9', 'SAE J423']
        },
        authorId: users[4]._id.toString(),
        status: 'APPROVED'
      }
    ]);

    const recipes = await RecipeModel.create([
      {
        tenantId: TENANT_ID,
        recipeCode: 'REC-VAC-4340',
        revision: 1,
        name: 'Vacuum Austenitize, 2-Bar N2 Quench & Double Temper',
        description: 'Automated 5-stage thermal recipe for turbine rotor shaft processing',
        processFamily: 'NEUTRAL_HARDENING',
        applicableMaterialGrades: ['AISI 4340'],
        stages: [
          {
            sequence: 1,
            stageName: 'Preheat Ramp',
            targetTemperatureC: 650,
            temperatureToleranceMinusC: 5,
            temperatureTolerancePlusC: 5,
            rampRateCPerMin: 10,
            soakTimeMinutes: 45,
            atmosphereControl: { type: 'VACUUM', setpoint: 0.01 }
          },
          {
            sequence: 2,
            stageName: 'Austenitizing Soak',
            targetTemperatureC: 845,
            temperatureToleranceMinusC: 5,
            temperatureTolerancePlusC: 5,
            rampRateCPerMin: 8,
            soakTimeMinutes: 90,
            atmosphereControl: { type: 'VACUUM', setpoint: 0.01 }
          },
          {
            sequence: 3,
            stageName: 'Vacuum N2 Gas Quench',
            targetTemperatureC: 50,
            temperatureToleranceMinusC: 10,
            temperatureTolerancePlusC: 10,
            soakTimeMinutes: 30,
            quenchParameters: {
              medium: 'HIGH_PRESSURE_GAS_N2',
              targetTemperatureC: 50,
              gasQuenchPressureBar: 2.0
            }
          },
          {
            sequence: 4,
            stageName: 'First Temper',
            targetTemperatureC: 540,
            temperatureToleranceMinusC: 5,
            temperatureTolerancePlusC: 5,
            rampRateCPerMin: 12,
            soakTimeMinutes: 120
          },
          {
            sequence: 5,
            stageName: 'Second Temper',
            targetTemperatureC: 540,
            temperatureToleranceMinusC: 5,
            temperatureTolerancePlusC: 5,
            rampRateCPerMin: 12,
            soakTimeMinutes: 120
          }
        ],
        metallurgicalTargets: {
          targetHardnessMin: 58,
          targetHardnessMax: 62,
          hardnessScale: 'HRC'
        },
        machineRequirements: {
          compatibleFurnaceTypes: ['FURNACE_VACUUM'],
          minimumFurnaceClass: 'CLASS_2',
          maxOperatingTempRequiredC: 1000
        },
        authorId: users[4]._id.toString(),
        status: 'APPROVED'
      },
      {
        tenantId: TENANT_ID,
        recipeCode: 'REC-CARB-8620',
        revision: 1,
        name: 'Gas Carburizing 930C, Oil Quench & Low Temper',
        description: 'High-speed boost/diffuse gas carburizing recipe for heavy transmission gears',
        processFamily: 'CARBURIZING',
        applicableMaterialGrades: ['AISI 8620'],
        stages: [
          {
            sequence: 1,
            stageName: 'Carburizing Boost',
            targetTemperatureC: 930,
            temperatureToleranceMinusC: 5,
            temperatureTolerancePlusC: 5,
            soakTimeMinutes: 180,
            atmosphereControl: { type: 'CARBON_POTENTIAL', setpoint: 1.15 }
          },
          {
            sequence: 2,
            stageName: 'Carburizing Diffuse',
            targetTemperatureC: 930,
            temperatureToleranceMinusC: 5,
            temperatureTolerancePlusC: 5,
            soakTimeMinutes: 90,
            atmosphereControl: { type: 'CARBON_POTENTIAL', setpoint: 0.85 }
          },
          {
            sequence: 3,
            stageName: 'Equalize & Oil Quench',
            targetTemperatureC: 840,
            temperatureToleranceMinusC: 5,
            temperatureTolerancePlusC: 5,
            soakTimeMinutes: 45,
            quenchParameters: {
              medium: 'FAST_QUENCH_OIL',
              targetTemperatureC: 60,
              agitationSpeedPercent: 80
            }
          },
          {
            sequence: 4,
            stageName: 'Stress Relief Temper',
            targetTemperatureC: 180,
            temperatureToleranceMinusC: 5,
            temperatureTolerancePlusC: 5,
            soakTimeMinutes: 120
          }
        ],
        metallurgicalTargets: {
          targetHardnessMin: 60,
          targetHardnessMax: 64,
          hardnessScale: 'HRC',
          effectiveCaseDepthMinMm: 0.8,
          effectiveCaseDepthMaxMm: 1.2
        },
        machineRequirements: {
          compatibleFurnaceTypes: ['FURNACE_PIT', 'FURNACE_ATMOSPHERE_SEALED_QUENCH'],
          minimumFurnaceClass: 'CLASS_2',
          maxOperatingTempRequiredC: 1050
        },
        authorId: users[4]._id.toString(),
        status: 'APPROVED'
      }
    ]);

    // 8. Seed Machines & Furnace Fleet (AMS 2750G Pyrometry Instrumented)
    console.log('🔥 Seeding furnace fleet & pyrometry telemetry...');
    const machines = await MachineModel.create([
      {
        tenantId: TENANT_ID,
        machineCode: 'FURNACE-VAC-01',
        name: 'Ipsen TurboTreater 2-Bar Vacuum Furnace',
        category: 'FURNACE_VACUUM',
        status: 'RUNNING',
        technicalSpecs: {
          manufacturer: 'Ipsen International',
          modelNumber: 'TurboTreater V500',
          serialNumber: 'SN-IPSEN-VAC-9901',
          heatingSource: 'ELECTRIC_RESISTANCE',
          maxPowerKw: 150,
          atmosphereTypes: ['VACUUM', 'NITROGEN'],
          quenchMedia: ['HIGH_PRESSURE_GAS_N2']
        },
        thermalLimits: {
          minOperatingTempC: 300,
          maxOperatingTempC: 1300,
          uniformOperatingMinC: 450,
          uniformOperatingMaxC: 1250,
          maxHeatingRateCPerMin: 15,
          maxCoolingRateCPerMin: 25,
          temperatureUniformityToleranceC: 6
        },
        workingDimensions: {
          lengthMm: 1200,
          widthMm: 900,
          heightMm: 900,
          usableVolumeM3: 0.97,
          maxLoadWeightKg: 1000
        },
        location: {
          plant: 'Main Plant',
          building: 'Building A',
          bay: 'Bay 1 Vacuum Bay'
        },
        capabilities: {
          supportedProcessFamilies: ['NEUTRAL_HARDENING', 'TEMPERING', 'STRESS_RELIEVING', 'SOLUTION_TREATING_AGING'],
          furnaceClass: 'CLASS_2',
          instrumentationType: 'TYPE_B',
          pyrometryStandard: 'AMS_2750G'
        },
        pyrometryCompliance: {
          lastTusDate: new Date(Date.now() - 30 * 86400000),
          nextTusDueDate: new Date(Date.now() + 60 * 86400000),
          lastSatDate: new Date(Date.now() - 7 * 86400000),
          nextSatDueDate: new Date(Date.now() + 23 * 86400000),
          isTusValid: true,
          isSatValid: true
        }
      },
      {
        tenantId: TENANT_ID,
        machineCode: 'FURNACE-PIT-01',
        name: 'Surface Combustion Deep Pit Carburizer',
        category: 'FURNACE_PIT',
        status: 'RUNNING',
        technicalSpecs: {
          manufacturer: 'Surface Combustion',
          modelNumber: 'Pit-Master 1500',
          serialNumber: 'SN-SURF-PIT-8822',
          heatingSource: 'GAS_FIRED',
          maxPowerKw: 220,
          atmosphereTypes: ['ENDOTHERMIC_GAS', 'NATURAL_GAS'],
          quenchMedia: ['FAST_QUENCH_OIL']
        },
        thermalLimits: {
          minOperatingTempC: 400,
          maxOperatingTempC: 1050,
          uniformOperatingMinC: 750,
          uniformOperatingMaxC: 1000,
          maxHeatingRateCPerMin: 10,
          maxCoolingRateCPerMin: 15,
          temperatureUniformityToleranceC: 8
        },
        workingDimensions: {
          lengthMm: 1500,
          widthMm: 1500,
          heightMm: 2400,
          usableVolumeM3: 5.4,
          maxLoadWeightKg: 3500
        },
        location: {
          plant: 'Main Plant',
          building: 'Building B',
          bay: 'Bay 2 Atmosphere Bay'
        },
        capabilities: {
          supportedProcessFamilies: ['CARBURIZING', 'CARBONITRIDING', 'ANNEALING', 'NORMALIZING'],
          furnaceClass: 'CLASS_2',
          instrumentationType: 'TYPE_B',
          pyrometryStandard: 'CQI_9'
        },
        pyrometryCompliance: {
          lastTusDate: new Date(Date.now() - 45 * 86400000),
          nextTusDueDate: new Date(Date.now() + 45 * 86400000),
          lastSatDate: new Date(Date.now() - 10 * 86400000),
          nextSatDueDate: new Date(Date.now() + 20 * 86400000),
          isTusValid: true,
          isSatValid: true
        }
      },
      {
        tenantId: TENANT_ID,
        machineCode: 'FURNACE-SEAL-01',
        name: 'Holcroft Integral Sealed Quench Furnace',
        category: 'FURNACE_ATMOSPHERE_SEALED_QUENCH',
        status: 'IDLE',
        technicalSpecs: {
          manufacturer: 'Holcroft',
          modelNumber: 'SQ-Batch-750',
          serialNumber: 'SN-HOL-SQ-4401',
          heatingSource: 'GAS_FIRED',
          maxPowerKw: 180,
          atmosphereTypes: ['ENDOTHERMIC_GAS'],
          quenchMedia: ['FAST_QUENCH_OIL']
        },
        thermalLimits: {
          minOperatingTempC: 400,
          maxOperatingTempC: 1000,
          uniformOperatingMinC: 750,
          uniformOperatingMaxC: 980,
          temperatureUniformityToleranceC: 10
        },
        workingDimensions: {
          lengthMm: 1200,
          widthMm: 900,
          heightMm: 750,
          usableVolumeM3: 0.81,
          maxLoadWeightKg: 800
        },
        location: {
          plant: 'Main Plant',
          building: 'Building B',
          bay: 'Bay 3 Batch Line'
        },
        capabilities: {
          supportedProcessFamilies: ['CARBURIZING', 'NEUTRAL_HARDENING'],
          furnaceClass: 'CLASS_3',
          instrumentationType: 'TYPE_C',
          pyrometryStandard: 'STANDARD'
        },
        pyrometryCompliance: {
          lastTusDate: new Date(Date.now() - 60 * 86400000),
          nextTusDueDate: new Date(Date.now() + 30 * 86400000),
          lastSatDate: new Date(Date.now() - 15 * 86400000),
          nextSatDueDate: new Date(Date.now() + 15 * 86400000),
          isTusValid: true,
          isSatValid: true
        }
      },
      {
        tenantId: TENANT_ID,
        machineCode: 'FURNACE-TEMP-01',
        name: 'Despatch Forced Convection Tempering Oven',
        category: 'TEMPERING_OVEN',
        status: 'RUNNING',
        technicalSpecs: {
          manufacturer: 'Despatch Industries',
          modelNumber: 'RAD-2-19',
          serialNumber: 'SN-DESPATCH-T-3301',
          heatingSource: 'ELECTRIC_RESISTANCE',
          maxPowerKw: 45,
          atmosphereTypes: ['AIR'],
          quenchMedia: ['AIR_COOL']
        },
        thermalLimits: {
          minOperatingTempC: 100,
          maxOperatingTempC: 700,
          uniformOperatingMinC: 150,
          uniformOperatingMaxC: 650,
          temperatureUniformityToleranceC: 5
        },
        workingDimensions: {
          lengthMm: 1400,
          widthMm: 1000,
          heightMm: 1000,
          usableVolumeM3: 1.4,
          maxLoadWeightKg: 1200
        },
        location: {
          plant: 'Main Plant',
          building: 'Building A',
          bay: 'Bay 1 Vacuum Bay'
        },
        capabilities: {
          supportedProcessFamilies: ['TEMPERING', 'STRESS_RELIEVING'],
          furnaceClass: 'CLASS_2',
          instrumentationType: 'TYPE_B',
          pyrometryStandard: 'AMS_2750G'
        },
        pyrometryCompliance: {
          lastTusDate: new Date(Date.now() - 20 * 86400000),
          nextTusDueDate: new Date(Date.now() + 70 * 86400000),
          lastSatDate: new Date(Date.now() - 5 * 86400000),
          nextSatDueDate: new Date(Date.now() + 25 * 86400000),
          isTusValid: true,
          isSatValid: true
        }
      }
    ]);

    // 9. Seed Production Jobs Across Active Stages
    console.log('⚡ Seeding production batches & work orders...');
    const jobs = await ProductionJobModel.create([
      {
        tenantId: TENANT_ID,
        jobNumber: 'JOB-202608-0010',
        customer: {
          customerId: customers[0]._id.toString(),
          customerCode: customers[0].customerCode,
          customerName: customers[0].companyName
        },
        item: {
          itemId: items[3]._id.toString(),
          itemCode: items[3].itemCode,
          itemName: items[3].name,
          materialGrade: items[3].materialGrade,
          uom: items[3].uom
        },
        quantity: {
          targetQuantity: 100,
          loadedQuantity: 100,
          completedQuantity: 0,
          scrappedQuantity: 0
        },
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        recipeSnapshot: {
          recipeId: recipes[0]._id.toString(),
          recipeCode: recipes[0].recipeCode,
          revisionNumber: 1,
          processFamily: recipes[0].processFamily,
          name: recipes[0].name,
          applicableMaterialGrades: ['AISI 4340'],
          stages: recipes[0].stages,
          metallurgicalTargets: recipes[0].metallurgicalTargets,
          machineRequirements: recipes[0].machineRequirements
        },
        specificationSnapshot: {
          specificationId: specifications[0]._id.toString(),
          specCode: specifications[0].specCode,
          revisionNumber: 1,
          title: specifications[0].title,
          customerCode: customers[0].customerCode,
          surfaceHardness: specifications[0].surfaceHardness
        },
        materialAllocations: [
          {
            allocationId: 'ALLOC-001',
            heatLotId: heatLots[0]._id.toString(),
            heatLotNumber: heatLots[0].heatLotNumber,
            allocatedQuantity: 850,
            uom: 'KG',
            allocatedBy: { userId: users[1]._id.toString(), email: users[1].email }
          }
        ],
        equipmentAssignment: {
          primaryMachineId: machines[0]._id.toString(),
          primaryMachineCode: machines[0].machineCode,
          assignedAt: new Date(Date.now() - 4 * 3600000)
        },
        operatorAssignment: {
          primaryOperatorId: users[3]._id.toString(),
          primaryOperatorCode: users[3].username,
          primaryOperatorName: `${users[3].firstName} ${users[3].lastName}`,
          assignedAt: new Date(Date.now() - 4 * 3600000)
        },
        timeline: {
          plannedStartDate: new Date(Date.now() - 4 * 3600000),
          targetCompletionDate: new Date(Date.now() + 4 * 3600000),
          actualStartDate: new Date(Date.now() - 3.5 * 3600000)
        },
        execution: {
          furnaceCharge: {
            chargeNumber: 'CHG-001',
            loadedWeightKg: 850,
            loadedPieceCount: 100,
            initialFurnaceTempC: 25,
            startedAt: new Date(Date.now() - 3.5 * 3600000),
            startedBy: { userId: users[3]._id.toString(), email: users[3].email }
          },
          cycleTimer: {
            cycleStartTime: new Date(Date.now() - 3.5 * 3600000),
            totalRunDurationMinutes: 210
          },
          stageProgress: [
            {
              stageSequence: 1,
              stageName: 'Preheat Ramp',
              stageType: 'PREHEAT',
              targetTemperatureC: 650,
              actualTemperatureC: 650,
              targetDurationMinutes: 45,
              actualDurationMinutes: 45,
              recordedBy: { userId: users[3]._id.toString() }
            },
            {
              stageSequence: 2,
              stageName: 'Austenitizing Soak',
              stageType: 'SOAK',
              targetTemperatureC: 845,
              actualTemperatureC: 846,
              targetDurationMinutes: 90,
              actualDurationMinutes: 75,
              recordedBy: { userId: users[3]._id.toString() }
            }
          ]
        }
      },
      {
        tenantId: TENANT_ID,
        jobNumber: 'JOB-202608-0011',
        customer: {
          customerId: customers[1]._id.toString(),
          customerCode: customers[1].customerCode,
          customerName: customers[1].companyName
        },
        item: {
          itemId: items[4]._id.toString(),
          itemCode: items[4].itemCode,
          itemName: items[4].name,
          materialGrade: items[4].materialGrade,
          uom: items[4].uom
        },
        quantity: {
          targetQuantity: 250,
          loadedQuantity: 250,
          completedQuantity: 0,
          scrappedQuantity: 0
        },
        status: 'IN_PROGRESS',
        priority: 'URGENT',
        recipeSnapshot: {
          recipeId: recipes[1]._id.toString(),
          recipeCode: recipes[1].recipeCode,
          revisionNumber: 1,
          processFamily: recipes[1].processFamily,
          name: recipes[1].name,
          applicableMaterialGrades: ['AISI 8620'],
          stages: recipes[1].stages,
          metallurgicalTargets: recipes[1].metallurgicalTargets,
          machineRequirements: recipes[1].machineRequirements
        },
        specificationSnapshot: {
          specificationId: specifications[1]._id.toString(),
          specCode: specifications[1].specCode,
          revisionNumber: 1,
          title: specifications[1].title,
          customerCode: customers[1].customerCode,
          surfaceHardness: specifications[1].surfaceHardness
        },
        materialAllocations: [
          {
            allocationId: 'ALLOC-002',
            heatLotId: heatLots[1]._id.toString(),
            heatLotNumber: heatLots[1].heatLotNumber,
            allocatedQuantity: 1420,
            uom: 'KG',
            allocatedBy: { userId: users[1]._id.toString(), email: users[1].email }
          }
        ],
        equipmentAssignment: {
          furnaceId: machines[1]._id.toString(),
          furnaceCode: machines[1].machineCode
        },
        timeline: {
          plannedStartDate: new Date(Date.now() - 6 * 3600000),
          targetCompletionDate: new Date(Date.now() + 6 * 3600000),
          actualStartDate: new Date(Date.now() - 5.5 * 3600000)
        }
      },
      {
        tenantId: TENANT_ID,
        jobNumber: 'JOB-202608-0008',
        customer: {
          customerId: customers[2]._id.toString(),
          customerCode: customers[2].customerCode,
          customerName: customers[2].companyName
        },
        item: {
          itemId: items[4]._id.toString(),
          itemCode: items[4].itemCode,
          itemName: items[4].name,
          materialGrade: items[4].materialGrade,
          uom: items[4].uom
        },
        quantity: {
          targetQuantity: 300,
          loadedQuantity: 300,
          completedQuantity: 300,
          scrappedQuantity: 0
        },
        status: 'COMPLETED',
        priority: 'NORMAL',
        recipeSnapshot: {
          recipeId: recipes[1]._id.toString(),
          recipeCode: recipes[1].recipeCode,
          revisionNumber: 1,
          processFamily: recipes[1].processFamily,
          name: recipes[1].name,
          applicableMaterialGrades: ['AISI 8620'],
          stages: recipes[1].stages,
          metallurgicalTargets: recipes[1].metallurgicalTargets,
          machineRequirements: recipes[1].machineRequirements
        },
        specificationSnapshot: {
          specificationId: specifications[1]._id.toString(),
          specCode: specifications[1].specCode,
          revisionNumber: 1,
          title: specifications[1].title,
          customerCode: customers[2].customerCode,
          surfaceHardness: specifications[1].surfaceHardness
        },
        timeline: {
          plannedStartDate: new Date(Date.now() - 28 * 3600000),
          targetCompletionDate: new Date(Date.now() - 14 * 3600000),
          actualStartDate: new Date(Date.now() - 26 * 3600000),
          actualCompletionDate: new Date(Date.now() - 14 * 3600000)
        }
      },
      {
        tenantId: TENANT_ID,
        jobNumber: 'JOB-202608-0009',
        customer: {
          customerId: customers[0]._id.toString(),
          customerCode: customers[0].customerCode,
          customerName: customers[0].companyName
        },
        item: {
          itemId: items[3]._id.toString(),
          itemCode: items[3].itemCode,
          itemName: items[3].name,
          materialGrade: items[3].materialGrade,
          uom: items[3].uom
        },
        quantity: {
          targetQuantity: 120,
          loadedQuantity: 120,
          completedQuantity: 120,
          scrappedQuantity: 0
        },
        status: 'COMPLETED',
        priority: 'NORMAL',
        recipeSnapshot: {
          recipeId: recipes[0]._id.toString(),
          recipeCode: recipes[0].recipeCode,
          revisionNumber: 1,
          processFamily: recipes[0].processFamily,
          name: recipes[0].name,
          applicableMaterialGrades: ['AISI 4340'],
          stages: recipes[0].stages,
          metallurgicalTargets: recipes[0].metallurgicalTargets,
          machineRequirements: recipes[0].machineRequirements
        },
        specificationSnapshot: {
          specificationId: specifications[0]._id.toString(),
          specCode: specifications[0].specCode,
          revisionNumber: 1,
          title: specifications[0].title,
          customerCode: customers[0].customerCode,
          surfaceHardness: specifications[0].surfaceHardness
        },
        timeline: {
          plannedStartDate: new Date(Date.now() - 20 * 3600000),
          targetCompletionDate: new Date(Date.now() - 8 * 3600000),
          actualStartDate: new Date(Date.now() - 18 * 3600000),
          actualCompletionDate: new Date(Date.now() - 8 * 3600000)
        }
      }
    ]);

    // 10. Seed Quality Inspections & NCRs
    console.log('🧪 Seeding quality inspections & lab records...');
    const inspections = await QualityInspectionModel.create([
      {
        tenantId: TENANT_ID,
        inspectionNumber: 'QC-202608-0001',
        jobId: jobs[2]._id.toString(),
        jobNumber: jobs[2].jobNumber,
        status: 'APPROVED',
        disposition: 'CONFORMING',
        customer: {
          customerId: customers[2]._id.toString(),
          customerCode: customers[2].customerCode,
          customerName: customers[2].companyName
        },
        item: {
          itemId: items[4]._id.toString(),
          itemCode: items[4].itemCode,
          itemName: items[4].name,
          materialGrade: items[4].materialGrade,
          uom: items[4].uom
        },
        heatLots: [
          {
            heatLotId: heatLots[1]._id.toString(),
            heatLotNumber: heatLots[1].heatLotNumber,
            allocatedQuantity: 1650,
            uom: 'KG'
          }
        ],
        recipeSnapshot: {
          recipeId: recipes[1]._id.toString(),
          recipeCode: recipes[1].recipeCode,
          revisionNumber: 1,
          processFamily: recipes[1].processFamily,
          name: recipes[1].name
        },
        specificationSnapshot: {
          specificationId: specifications[1]._id.toString(),
          specCode: specifications[1].specCode,
          revisionNumber: 1,
          title: specifications[1].title,
          surfaceHardness: specifications[1].surfaceHardness
        },
        inspectionQuantity: {
          sampleSize: 10,
          totalLotQuantity: 300,
          unitOfMeasure: 'PCS'
        },
        testResults: {
          hardnessTests: [
            { pointIdentifier: 'P1-SURFACE', location: 'SURFACE', measuredValue: 61.2, scale: 'HRC', targetMin: 60, targetMax: 64, passed: true },
            { pointIdentifier: 'P2-SURFACE', location: 'SURFACE', measuredValue: 60.8, scale: 'HRC', targetMin: 60, targetMax: 64, passed: true },
            { pointIdentifier: 'P3-CORE', location: 'CORE', measuredValue: 36.5, scale: 'HRC', passed: true }
          ],
          caseDepth: {
            effectiveCaseDepthMm: 1.05,
            cutoffHardnessHrc: 50,
            targetMinMm: 0.8,
            targetMaxMm: 1.2,
            passed: true
          },
          microstructure: {
            observedStructure: 'Tempered martensite matrix with uniform carbide dispersion. Zero retained austenite.',
            passed: true
          },
          overallTestPassed: true
        }
      },
      {
        tenantId: TENANT_ID,
        inspectionNumber: 'QC-202608-0002',
        jobId: jobs[3]._id.toString(),
        jobNumber: jobs[3].jobNumber,
        status: 'APPROVED',
        disposition: 'CONFORMING',
        customer: {
          customerId: customers[0]._id.toString(),
          customerCode: customers[0].customerCode,
          customerName: customers[0].companyName
        },
        item: {
          itemId: items[3]._id.toString(),
          itemCode: items[3].itemCode,
          itemName: items[3].name,
          materialGrade: items[3].materialGrade,
          uom: items[3].uom
        },
        heatLots: [
          {
            heatLotId: heatLots[0]._id.toString(),
            heatLotNumber: heatLots[0].heatLotNumber,
            allocatedQuantity: 980,
            uom: 'KG'
          }
        ],
        recipeSnapshot: {
          recipeId: recipes[0]._id.toString(),
          recipeCode: recipes[0].recipeCode,
          revisionNumber: 1,
          processFamily: recipes[0].processFamily,
          name: recipes[0].name
        },
        specificationSnapshot: {
          specificationId: specifications[0]._id.toString(),
          specCode: specifications[0].specCode,
          revisionNumber: 1,
          title: specifications[0].title,
          surfaceHardness: specifications[0].surfaceHardness
        },
        inspectionQuantity: {
          sampleSize: 8,
          totalLotQuantity: 120,
          unitOfMeasure: 'PCS'
        },
        testResults: {
          hardnessTests: [
            { pointIdentifier: 'P1-SURFACE', location: 'SURFACE', measuredValue: 59.8, scale: 'HRC', targetMin: 58, targetMax: 62, passed: true },
            { pointIdentifier: 'P2-SURFACE', location: 'SURFACE', measuredValue: 60.1, scale: 'HRC', targetMin: 58, targetMax: 62, passed: true }
          ],
          microstructure: {
            observedStructure: '100% fine needle-like tempered martensite structure. Pass AMS 2759/1.',
            passed: true
          },
          overallTestPassed: true
        },
        approvedBy: {
          userId: users[5]._id.toString(),
          email: users[5].email,
          role: 'METALLURGICAL_LAB_TECH',
          approvedAt: new Date(Date.now() - 6 * 3600000),
          remarks: 'Aerospace hardness and structure approved.'
        }
      }
    ]);

    const ncrs = await NonConformanceReportModel.create([
      {
        tenantId: TENANT_ID,
        ncrNumber: 'NCR-202608-0001',
        status: 'OPEN',
        jobId: jobs[1]._id.toString(),
        jobNumber: jobs[1].jobNumber,
        customer: {
          customerId: customers[1]._id.toString(),
          customerCode: customers[1].customerCode,
          customerName: customers[1].companyName
        },
        item: {
          itemId: items[4]._id.toString(),
          itemCode: items[4].itemCode,
          itemName: items[4].name,
          materialGrade: items[4].materialGrade,
          uom: items[4].uom
        },
        defectType: 'EXCESSIVE_DECARBURIZATION',
        defectSeverity: 'MAJOR',
        defectDescription: 'Surface Decarburization on pilot test coupons. Micro-hardness traverse revealed 0.05mm total decarburization.',
        affectedQuantity: {
          totalAffectedQuantity: 15,
          rejectedQuantity: 15,
          scrappedQuantity: 0,
          reworkedQuantity: 0,
          uom: 'PCS'
        },
        containment: {
          containmentAction: 'Quarantine 15 test coupons and hold batch for atmosphere review.',
          isQuarantined: true,
          quarantineBay: 'Bay 2 QA Quarantine Cage',
          containedBy: {
            userId: users[4]._id.toString(),
            email: users[4].email,
            role: 'QUALITY_MANAGER'
          }
        },
        raisedBy: {
          userId: users[5]._id.toString(),
          email: users[5].email,
          role: 'METALLURGICAL_LAB_TECH'
        },
        raisedAt: new Date(Date.now() - 2 * 3600000)
      }
    ]);

    // 11. Seed Warehouses & Dispatches
    console.log('🚚 Seeding warehouses & dispatch gate passes...');
    const warehouses = await WarehouseModel.create([
      {
        tenantId: TENANT_ID,
        code: 'WH-MAIN-01',
        name: 'Main Plant Thermal Stores',
        type: 'MAIN_PLANT',
        plantArea: 'Bay 1-4 Central Floor',
        status: 'ACTIVE'
      },
      {
        tenantId: TENANT_ID,
        code: 'WH-FG-01',
        name: 'Finished Goods & Shipping Dock',
        type: 'FINISHED_STORE',
        plantArea: 'Outbound Loading Dock Bay 5',
        status: 'ACTIVE'
      }
    ]);

    const dispatches = await DispatchConsignmentModel.create([
      {
        tenantId: TENANT_ID,
        dispatchNumber: 'DSP-202608-0001',
        deliveryChallanNumber: 'DC-2026-0881',
        status: 'DISPATCHED',
        customer: {
          customerId: customers[2]._id.toString(),
          customerCode: customers[2].customerCode,
          customerName: customers[2].companyName,
          destinationAddress: '400 Industrial Way, Detroit, MI 48201',
          contactPerson: 'Gianni Romano',
          contactPhone: '+1-555-773-2001'
        },
        lines: [
          {
            lineId: 'LINE-01',
            finishedGoodsId: 'FG-001',
            fgLotNumber: 'FG-8620-3001',
            jobId: jobs[2]._id.toString(),
            jobNumber: jobs[2].jobNumber,
            heatLotNumber: heatLots[1].heatLotNumber,
            itemId: items[4]._id.toString(),
            itemCode: items[4].itemCode,
            itemName: items[4].name,
            materialGrade: items[4].materialGrade,
            dispatchedQuantity: 300,
            uom: 'PCS',
            packageDetails: {
              packagingType: 'STEEL_CRATE',
              packageCount: 2,
              grossWeightKg: 1720,
              netWeightKg: 1650
            },
            qualityVerification: {
              isQualityApproved: true,
              cocNumber: 'COC-2026-0045'
            }
          }
        ],
        totalQuantity: 300,
        totalPackages: 2,
        totalNetWeightKg: 1650,
        totalGrossWeightKg: 1720,
        carrier: {
          carrierName: 'Swift Heavy Logistics Inc.',
          transportMode: 'ROAD',
          trackingNumber: 'TRK-SWIFT-994821'
        },
        vehicle: {
          vehicleNumber: 'MH-12-AB-9901',
          vehicleType: 'HEAVY_TRUCK',
          ewayBillNumber: 'EWB-2026-990144'
        },
        driver: {
          driverName: 'Frank Miller',
          driverPhone: '+1-555-901-2244'
        },
        timeline: {
          createdAt: new Date(Date.now() - 6 * 3600000),
          scheduledDepartureTime: new Date(Date.now() - 5.5 * 3600000),
          actualDepartureTime: new Date(Date.now() - 5 * 3600000)
        },
        gatePass: {
          gatePassNumber: 'GP-2026-0881',
          securityOfficerName: 'James Wilson',
          issuedAt: new Date(Date.now() - 5 * 3600000)
        }
      },
      {
        tenantId: TENANT_ID,
        dispatchNumber: 'DSP-202608-0002',
        deliveryChallanNumber: 'DC-2026-0882',
        status: 'SCHEDULED',
        customer: {
          customerId: customers[0]._id.toString(),
          customerCode: customers[0].customerCode,
          customerName: customers[0].companyName,
          destinationAddress: '100 Aerospace Blvd, Seattle, WA 98101',
          contactPerson: 'David Miller',
          contactPhone: '+1-555-432-8899'
        },
        lines: [
          {
            lineId: 'LINE-02',
            finishedGoodsId: 'FG-002',
            fgLotNumber: 'FG-4340-1201',
            jobId: jobs[3]._id.toString(),
            jobNumber: jobs[3].jobNumber,
            heatLotNumber: heatLots[0].heatLotNumber,
            itemId: items[3]._id.toString(),
            itemCode: items[3].itemCode,
            itemName: items[3].name,
            materialGrade: items[3].materialGrade,
            dispatchedQuantity: 120,
            uom: 'PCS',
            packageDetails: {
              packagingType: 'FOAM_INSERT_CRATE',
              packageCount: 1,
              grossWeightKg: 1040,
              netWeightKg: 980
            },
            qualityVerification: {
              isQualityApproved: true,
              cocNumber: 'COC-2026-0046'
            }
          }
        ],
        totalQuantity: 120,
        totalPackages: 1,
        totalNetWeightKg: 980,
        totalGrossWeightKg: 1040,
        carrier: {
          carrierName: 'Aero Freight Express',
          transportMode: 'AIR',
          trackingNumber: 'TRK-AFE-881290'
        },
        timeline: {
          createdAt: new Date(Date.now() - 2 * 3600000),
          scheduledDepartureTime: new Date(Date.now() + 4 * 3600000)
        }
      }
    ]);

    // 12. Seed Billing & Invoices
    console.log('💵 Seeding factory billing & accounts receivable...');
    const invoices = await Invoice.create([
      {
        tenantId: TENANT_ID,
        invoiceNumber: 'INV-2026-0089',
        customerId: customers[0]._id.toString(),
        customerCode: customers[0].customerCode,
        customerName: customers[0].companyName,
        customerBillingAddress: '100 Aerospace Blvd, Seattle, WA 98101',
        invoiceDate: new Date(Date.now() - 2 * 86400000),
        dueDate: new Date(Date.now() + 28 * 86400000),
        paymentTermsDays: 30,
        status: 'ISSUED',
        lines: [
          {
            lineId: 'LINE-01',
            jobId: jobs[3]._id,
            jobNumber: jobs[3].jobNumber,
            itemCode: items[3].itemCode,
            description: 'Aerospace Vacuum Heat Treatment of Turbine Rotor Shafts',
            quantity: 120,
            uom: 'PCS',
            unitPrice: 108.75,
            subtotal: 13050.0,
            heatLotNumber: heatLots[0].heatLotNumber,
            certificateOfConformanceNumber: 'COC-2026-0046',
            taxRatePercent: 10.0,
            taxAmount: 1450.0,
            totalAmount: 14500.0
          }
        ],
        subtotal: 13050.0,
        totalTaxAmount: 1450.0,
        totalAmount: 14500.0,
        paidAmount: 0,
        outstandingBalance: 14500.0,
        isFinalized: true,
        finalizedAt: new Date(Date.now() - 2 * 86400000)
      },
      {
        tenantId: TENANT_ID,
        invoiceNumber: 'INV-2026-0088',
        customerId: customers[2]._id.toString(),
        customerCode: customers[2].customerCode,
        customerName: customers[2].companyName,
        customerBillingAddress: '400 Industrial Way, Detroit, MI 48201',
        invoiceDate: new Date(Date.now() - 15 * 86400000),
        dueDate: new Date(Date.now() + 15 * 86400000),
        paymentTermsDays: 30,
        status: 'PAID',
        lines: [
          {
            lineId: 'LINE-01',
            jobId: jobs[2]._id,
            jobNumber: jobs[2].jobNumber,
            itemCode: items[4].itemCode,
            description: 'High-Volume Gas Carburizing & Oil Quench Pinion Gears',
            quantity: 300,
            uom: 'PCS',
            unitPrice: 86.25,
            subtotal: 25875.0,
            heatLotNumber: heatLots[1].heatLotNumber,
            certificateOfConformanceNumber: 'COC-2026-0045',
            taxRatePercent: 10.0,
            taxAmount: 2875.0,
            totalAmount: 28750.0
          }
        ],
        subtotal: 25875.0,
        totalTaxAmount: 2875.0,
        totalAmount: 28750.0,
        paidAmount: 28750.0,
        outstandingBalance: 0,
        isFinalized: true,
        finalizedAt: new Date(Date.now() - 15 * 86400000)
      }
    ]);

    // 13. Seed Job Costing & Profitability
    console.log('📊 Seeding job costing & margin analytics...');
    const jobCosts = await JobCost.create([
      {
        tenantId: TENANT_ID,
        costingNumber: 'COST-202608-0008',
        jobId: jobs[2]._id.toString(),
        jobNumber: jobs[2].jobNumber,
        customerId: customers[2]._id.toString(),
        customerCode: customers[2].customerCode,
        customerName: customers[2].companyName,
        itemId: items[4]._id.toString(),
        itemCode: items[4].itemCode,
        itemName: items[4].name,
        processedQuantity: 300,
        processedWeightKg: 1650,
        uom: 'PCS',
        costingDate: new Date(Date.now() - 10 * 3600000),
        status: 'FROZEN',
        rateCardId: 'RC-001',
        rateCardCode: 'STD-RATES-2026',
        rateCardRevision: 1,
        rateCardSnapshot: {
          standardLaborRatePerHour: 35.0,
          overtimeLaborRatePerHour: 52.5,
          specialistMetallurgistRatePerHour: 75.0,
          defaultMachineRatePerHour: 110.0,
          utilityRates: {
            electricityRatePerKwh: 0.14,
            naturalGasRatePerM3: 0.85,
            nitrogenGasRatePerM3: 0.35,
            argonGasRatePerM3: 1.2,
            vacuumQuenchOilRatePerLiter: 4.5,
            saltBathChemicalRatePerKg: 6.0
          },
          overheadRates: {
            overheadMethod: 'PER_MACHINE_HOUR',
            overheadRate: 25.0,
            qualityAssuranceOverheadPerJob: 150.0,
            plantDepreciationRatePerHour: 12.0
          }
        },
        materialCosts: {
          standardCost: 4800.0,
          actualCost: 4800.0,
          variance: 0
        },
        consumableCosts: {
          standardCost: 500.0,
          actualCost: 450.0,
          variance: -50.0
        },
        laborCosts: {
          standardCost: 2100.0,
          actualCost: 2100.0,
          variance: 0,
          totalRegularHours: 60,
          totalOvertimeHours: 0
        },
        machineCosts: {
          standardCost: 4400.0,
          actualCost: 4400.0,
          variance: 0,
          totalRuntimeHours: 40,
          totalSetupHours: 2
        },
        energyCosts: {
          standardCost: 1850.0,
          actualCost: 1850.0,
          variance: 0,
          totalKwhCalculated: 13200
        },
        overheadCosts: {
          standardCost: 1400.0,
          actualCost: 1400.0,
          variance: 0
        },
        totalStandardCost: 15200.0,
        totalActualCost: 14550.0,
        totalVariance: -650.0,
        totalVariancePercentage: -4.28,
        unitCostStandard: 50.67,
        unitCostActual: 48.5,
        totalRevenueBilled: 25875.0,
        manufacturingContribution: 11325.0,
        contributionMarginPercentage: 43.76,
        grossProfit: 11325.0,
        grossMarginPercentage: 43.76,
        profitabilityStatus: 'HIGH_MARGIN',
        isFrozen: true,
        frozenAt: new Date(Date.now() - 10 * 3600000),
        frozenBy: {
          userId: users[9]._id.toString(),
          email: users[9].email,
          role: 'FINANCE_CONTROLLER'
        }
      },
      {
        tenantId: TENANT_ID,
        costingNumber: 'COST-202608-0009',
        jobId: jobs[3]._id.toString(),
        jobNumber: jobs[3].jobNumber,
        customerId: customers[0]._id.toString(),
        customerCode: customers[0].customerCode,
        customerName: customers[0].companyName,
        itemId: items[3]._id.toString(),
        itemCode: items[3].itemCode,
        itemName: items[3].name,
        processedQuantity: 120,
        processedWeightKg: 980,
        uom: 'PCS',
        costingDate: new Date(Date.now() - 5 * 3600000),
        status: 'FROZEN',
        rateCardId: 'RC-001',
        rateCardCode: 'STD-RATES-2026',
        rateCardRevision: 1,
        rateCardSnapshot: {
          standardLaborRatePerHour: 35.0,
          overtimeLaborRatePerHour: 52.5,
          specialistMetallurgistRatePerHour: 75.0,
          defaultMachineRatePerHour: 110.0,
          utilityRates: {
            electricityRatePerKwh: 0.14,
            naturalGasRatePerM3: 0.85,
            nitrogenGasRatePerM3: 0.35,
            argonGasRatePerM3: 1.2,
            vacuumQuenchOilRatePerLiter: 4.5,
            saltBathChemicalRatePerKg: 6.0
          },
          overheadRates: {
            overheadMethod: 'PER_MACHINE_HOUR',
            overheadRate: 25.0,
            qualityAssuranceOverheadPerJob: 150.0,
            plantDepreciationRatePerHour: 12.0
          }
        },
        materialCosts: {
          standardCost: 3200.0,
          actualCost: 3200.0,
          variance: 0
        },
        consumableCosts: {
          standardCost: 400.0,
          actualCost: 400.0,
          variance: 0
        },
        laborCosts: {
          standardCost: 1450.0,
          actualCost: 1450.0,
          variance: 0,
          totalRegularHours: 41.4,
          totalOvertimeHours: 0
        },
        machineCosts: {
          standardCost: 2800.0,
          actualCost: 2800.0,
          variance: 0,
          totalRuntimeHours: 25.4,
          totalSetupHours: 1.5
        },
        energyCosts: {
          standardCost: 950.0,
          actualCost: 950.0,
          variance: 0,
          totalKwhCalculated: 6780
        },
        overheadCosts: {
          standardCost: 800.0,
          actualCost: 800.0,
          variance: 0
        },
        totalStandardCost: 9600.0,
        totalActualCost: 9200.0,
        totalCostVariance: -400.0,
        totalVariance: -400.0,
        totalVariancePercentage: -4.17,
        unitCostStandard: 80.0,
        unitCostActual: 76.67,
        totalRevenueBilled: 13050.0,
        manufacturingContribution: 3850.0,
        contributionMarginPercentage: 29.5,
        grossProfit: 3850.0,
        grossMarginPercentage: 29.5,
        profitabilityStatus: 'STANDARD_MARGIN',
        isFrozen: true,
        frozenAt: new Date(Date.now() - 5 * 3600000),
        frozenBy: {
          userId: users[9]._id.toString(),
          email: users[9].email,
          role: 'FINANCE_CONTROLLER'
        }
      }
    ]);

    // 14. Seed Maintenance & Pyrometry Work Orders
    console.log('🔧 Seeding maintenance work orders...');
    const workOrders = await MaintenanceWorkOrderModel.create([
      {
        tenantId: TENANT_ID,
        workOrderNumber: 'WO-2026-0012',
        machineId: machines[0]._id.toString(),
        machineCode: machines[0].machineCode,
        workOrderType: 'PREVENTIVE',
        priority: 'HIGH',
        status: 'OPEN',
        scheduledDate: new Date(Date.now() + 3 * 86400000),
        estimatedDurationHours: 4.5,
        notes: 'Quarterly AMS 2750G Temperature Uniformity Survey (TUS) 9-point thermocouple test'
      },
      {
        tenantId: TENANT_ID,
        workOrderNumber: 'WO-2026-0014',
        machineId: machines[1]._id.toString(),
        machineCode: machines[1].machineCode,
        workOrderType: 'CALIBRATION',
        priority: 'MEDIUM',
        status: 'OPEN',
        scheduledDate: new Date(Date.now() + 5 * 86400000),
        estimatedDurationHours: 2.0,
        notes: 'System Accuracy Test (SAT) control thermocouple calibration verification'
      }
    ]);

    // 15. Seed Workforce Shift Rosters
    console.log('⏰ Seeding shift roster & attendance...');
    const shifts = await ShiftModel.create([
      {
        tenantId: TENANT_ID,
        shiftCode: 'SHIFT-MORNING-A',
        name: 'Morning Thermal Operations Shift A',
        startTime: '06:00',
        endTime: '14:00',
        durationHours: 8,
        isActive: true
      },
      {
        tenantId: TENANT_ID,
        shiftCode: 'SHIFT-EVENING-B',
        name: 'Evening Vacuum & Quench Shift B',
        startTime: '14:00',
        endTime: '22:00',
        durationHours: 8,
        isActive: true
      }
    ]);

    // 16. Seed Notifications & Alerts
    console.log('🔔 Seeding factory alerts & notifications...');
    const notifications = await Notification.create([
      {
        tenantId: TENANT_ID,
        recipientUserId: users[0]._id.toString(),
        title: 'High-Priority Dispatch Consignment Ready',
        message: 'Dispatch consignment DSP-202608-0002 for AeroDynamics Propulsion is ready for gate pass sign-off',
        category: 'DISPATCH',
        priority: 'HIGH',
        sourceEvent: 'DISPATCH_READY',
        sourceEntityType: 'DispatchConsignment',
        sourceEntityId: dispatches[1]._id.toString(),
        actionUrl: '/dispatches/DSP-202608-0002',
        channelsSent: ['IN_APP'],
        isRead: false
      },
      {
        tenantId: TENANT_ID,
        recipientUserId: users[4]._id.toString(),
        title: 'Pending Quality NCR Disposition Required',
        message: 'NCR-202608-0001 (Decarburization on pilot test coupons) requires Quality Manager sign-off',
        category: 'QUALITY',
        priority: 'CRITICAL',
        sourceEvent: 'NCR_CREATED',
        sourceEntityType: 'NonConformanceReport',
        sourceEntityId: ncrs[0]._id.toString(),
        actionUrl: '/quality/ncrs/NCR-202608-0001',
        channelsSent: ['IN_APP'],
        isRead: false
      },
      {
        tenantId: TENANT_ID,
        recipientUserId: users[6]._id.toString(),
        title: 'Upcoming AMS 2750G Pyrometry TUS Survey',
        message: 'FURNACE-VAC-01 is due for quarterly Temperature Uniformity Survey within 3 days (WO-2026-0012)',
        category: 'MAINTENANCE',
        priority: 'HIGH',
        sourceEvent: 'MAINTENANCE_DUE',
        sourceEntityType: 'MaintenanceWorkOrder',
        sourceEntityId: workOrders[0]._id.toString(),
        actionUrl: '/maintenance/WO-2026-0012',
        channelsSent: ['IN_APP'],
        isRead: false
      }
    ]);

    // 17. Seed Audit Log Trail
    console.log('📝 Seeding authoritative audit log entries...');
    await AuditLogModel.create([
      {
        tenantId: TENANT_ID,
        actorId: users[1]._id.toString(),
        actorEmail: users[1].email,
        actorRole: 'PLANT_MANAGER',
        action: 'JOB_STAGE_STARTED',
        entityType: 'ProductionJob',
        entityId: jobs[0]._id.toString(),
        afterState: { jobNumber: jobs[0].jobNumber, stage: 'AUSTENITIZING_SOAK', temperatureC: 845 },
        status: 'SUCCESS',
        occurredAt: new Date(Date.now() - 2.5 * 3600000)
      },
      {
        tenantId: TENANT_ID,
        actorId: users[4]._id.toString(),
        actorEmail: users[4].email,
        actorRole: 'QUALITY_MANAGER',
        action: 'QUALITY_INSPECTION_APPROVED',
        entityType: 'QualityInspection',
        entityId: inspections[0]._id.toString(),
        afterState: { inspectionNumber: inspections[0].inspectionNumber, hardnessHrc: 60.85 },
        status: 'SUCCESS',
        occurredAt: new Date(Date.now() - 12 * 3600000)
      },
      {
        tenantId: TENANT_ID,
        actorId: users[8]._id.toString(),
        actorEmail: users[8].email,
        actorRole: 'DISPATCH_OFFICER',
        action: 'DISPATCH_CONSIGNMENT_SHIPPED',
        entityType: 'DispatchConsignment',
        entityId: dispatches[0]._id.toString(),
        afterState: { dispatchNumber: dispatches[0].dispatchNumber, carrier: 'Swift Heavy Logistics Inc.' },
        status: 'SUCCESS',
        occurredAt: new Date(Date.now() - 5 * 3600000)
      }
    ]);

    console.log(`\n======================================================`);
    console.log(`✨ SAMPLE DATABASE SEEDING COMPLETED SUCCESSFULLY!`);
    console.log(`======================================================`);
    console.log(`\n🔑 Available Test Login Credentials:`);
    console.log(`   Owner / Admin:       admin@astralis.internal       / Password123!`);
    console.log(`   Plant Manager:       manager@astralis.internal     / Password123!`);
    console.log(`   Supervisor:          supervisor@astralis.internal  / Password123!`);
    console.log(`   Furnace Operator:    operator@astralis.internal    / Password123!`);
    console.log(`   Quality Manager:     qc@astralis.internal          / Password123!`);
    console.log(`   Lab Technician:      lab@astralis.internal         / Password123!`);
    console.log(`   Maintenance Tech:    maintenance@astralis.internal / Password123!`);
    console.log(`   Stores Lead:         stores@astralis.internal      / Password123!`);
    console.log(`   Dispatch Officer:    dispatch@astralis.internal    / Password123!`);
    console.log(`   Finance Controller:  finance@astralis.internal     / Password123!`);
    console.log(`\n🚀 You can now start the application and log in.`);
    console.log(`======================================================\n`);

    await disconnectDatabase();
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to seed sample database:', error);
    await disconnectDatabase();
    process.exit(1);
  }
}

// Execute directly when invoked via tsx
seedSampleDatabase();
