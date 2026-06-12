-- Scope lease_number uniqueness to (lease_number, property_id)
-- Previously globally unique; now allows same number across different properties/users

ALTER TABLE "leases" DROP CONSTRAINT "leases_lease_number_key";

ALTER TABLE "leases" ADD CONSTRAINT "leases_lease_number_property_id_key" UNIQUE ("lease_number", "property_id");
