CREATE TABLE "PermissionRole" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PermissionRole_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PermissionRole_name_key" ON "PermissionRole"("name");
CREATE TABLE "RolePermission" (
  "roleId" TEXT NOT NULL,
  "capability" TEXT NOT NULL,
  "effect" "RuleEffect" NOT NULL,
  CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId", "capability")
);
ALTER TABLE "User" ADD COLUMN "assignedRoleId" TEXT;
CREATE INDEX "User_assignedRoleId_idx" ON "User"("assignedRoleId");
ALTER TABLE "User" ADD CONSTRAINT "User_assignedRoleId_fkey" FOREIGN KEY ("assignedRoleId") REFERENCES "PermissionRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "PermissionRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
