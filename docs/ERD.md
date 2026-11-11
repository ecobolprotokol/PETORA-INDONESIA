# ERD Konseptual PETORA INDONESIA

- Status: ERD konseptual untuk analisis; belum siap menjadi dasar DDL sampai cardinality dan ownership direview.
- Rujukan: [DATABASE_DESIGN.md](DATABASE_DESIGN.md) dan [MASTER_SPECIFICATION.md](MASTER_SPECIFICATION.md).

Diagram ini menunjukkan kelompok domain dan arah keterkaitan konseptual. Panah tidak menyatakan cardinality, foreign key, ownership final, atau transaction boundary. Relasi tersebut harus dikonfirmasi sebelum migration.

```mermaid
flowchart LR
    Core[Core: Users, Roles, Audit, Settings]
    Branches[Branches]
    Customers[Customers]
    Pets[Pets]
    Catalog[Product and Service Catalog]
    Scheduling[Scheduling]
    POS[POS]
    Procurement[Procurement]
    Inventory[Inventory Ledger]
    Clinic[Clinic]
    Lab[Laboratory]
    Hospitalization[Hospitalization and Surgery]
    Grooming[Grooming]
    Boarding[Boarding]
    Billing[Unified Billing]
    Payments[Payments]
    Finance[Finance]
    Employees[Employees]
    Notifications[Notifications]
    Portal[Customer Portal]
    Reports[Reports and Analytics]

    Core -. access policy .-> Branches
    Branches -. operational scope .-> POS
    Branches -. operational scope .-> Clinic
    Branches -. operational scope .-> Inventory
    Customers -. shared profile .-> Pets
    Customers -. customer context .-> POS
    Pets -. patient context .-> Clinic
    Catalog -. sellable items .-> POS
    Catalog -. service reference .-> Clinic
    Catalog -. service reference .-> Grooming
    Catalog -. service reference .-> Boarding
    Procurement -. receiving .-> Inventory
    POS -. charge source .-> Billing
    Clinic -. charge source .-> Billing
    Lab -. charge source .-> Billing
    Hospitalization -. charge source .-> Billing
    Grooming -. charge source .-> Billing
    Boarding -. charge source .-> Billing
    POS -. stock consumption .-> Inventory
    Clinic -. medication usage .-> Inventory
    Clinic -. diagnostic workflow .-> Lab
    Clinic -. care workflow .-> Hospitalization
    Scheduling -. appointment .-> Clinic
    Scheduling -. appointment .-> Grooming
    Scheduling -. booking .-> Boarding
    Billing -. allocation .-> Payments
    Billing -. financial source .-> Finance
    Payments -. financial source .-> Finance
    Employees -. staff assignment .-> Scheduling
    Notifications -. delivery .-> Customers
    Portal -. authorized access .-> Customers
    Reports -. reads governed data .-> Billing
    Reports -. reads governed data .-> Inventory
    Reports -. reads governed data .-> Finance
```

## Entitas Konseptual

| Domain | Konsep yang diketahui | Hal yang belum diputuskan |
|---|---|---|
| Core/Branches | User, role/permission, branch, audit, settings | Cardinality, role model, branch assignment, audit schema |
| Customers/Pets | Customer profile, pet profile, medical history reference | Field, duplicate resolution, guardian relationship, retention |
| Catalog/Inventory/Procurement | Product/service, warehouse, movement, batch, supplier, purchase order, receipt | Units, costing, status, partial receipt, physical schema |
| POS/Billing/Payments/Finance | Sale, invoice/item, payment/allocation, refund/reversal, financial record | Lifecycle, currency/tax, accounting scope, numbering |
| Clinic/Services/Scheduling | Appointment, encounter/record, lab, hospitalization, grooming, boarding | Clinical workflow, capacities, cardinality, resource model |
| Employees/Notifications/Portal/Reports | Employee, delivery, portal identity, report metric | Scope, consent, access, metrics, retention |

## Tinjauan Wajib Sebelum DDL

Konfirmasi cardinality dan ownership setiap relasi; identifiers; soft-delete/retention; immutable ledger needs; unique/idempotency keys; branch ownership; audit records; transaction boundary; query/index needs; serta data migration/backup implications. Tidak ada DDL atau destructive migration yang dihasilkan dari diagram ini.