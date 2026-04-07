import { createContext, useContext, useEffect, useState } from "react";
import { TENANTS, DEFAULT_TENANT_ID } from "../../config/tenants";
import { setCurrentTenant } from "../../engine/mockEngine";

const TenantContext = createContext(null);

export function TenantProvider({ children }) {
  const [tenantId, setTenantId] = useState(DEFAULT_TENANT_ID);
  const tenant = TENANTS[tenantId] || TENANTS[DEFAULT_TENANT_ID];

  // Sync the engine's module-level tenant ref so async getters know which data to return.
  useEffect(() => {
    setCurrentTenant(tenantId);
  }, [tenantId]);

  return (
    <TenantContext.Provider
      value={{
        tenant,
        tenantId,
        setTenantId,
        allTenants: Object.values(TENANTS),
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used inside TenantProvider");
  return ctx;
}
