-- 1. Add the owner_id column so the creator is automatically assigned ownership
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();

-- 2. Drop the overly strict blanket policy
DROP POLICY IF EXISTS "Workspaces - Cross-reference Profiles" ON workspaces;

-- 3. Allow new sign-ups to INSERT their workspace
CREATE POLICY "Workspaces - Insert" ON workspaces
    FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- 4. Allow users to read workspaces they just created (owner_id) OR belong to via a profile
CREATE POLICY "Workspaces - Select" ON workspaces
    FOR SELECT TO authenticated USING (
        owner_id = auth.uid() OR 
        id IN (SELECT workspace_id FROM profiles WHERE id = auth.uid())
    );

-- 5. Allow users to update their workspace if they own it or are an admin/owner
CREATE POLICY "Workspaces - Update" ON workspaces
    FOR UPDATE TO authenticated USING (
        owner_id = auth.uid() OR 
        id IN (SELECT workspace_id FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'admin'))
    );
