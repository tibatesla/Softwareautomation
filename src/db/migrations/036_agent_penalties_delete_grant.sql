-- 036_agent_penalties_delete_grant.sql
--
-- Deleting a user with real accountability history (agent_penalties.agent_id
-- is NOT nullable, unlike lead_id -- see 028) currently has no way to
-- proceed: deleteUser blocks on any linked agent_penalties row, and even if
-- it didn't, there was no DELETE grant to clear them. Unlike the lead side
-- of a penalty row (kept, lead_id nulled -- the penalty event still matters
-- without knowing which lead it was about), the agent side is the essential
-- half of the record: a penalty with no agent to attribute it to is
-- meaningless, so deleting the user cascades to deleting their own penalty
-- rows outright rather than trying to preserve them.

GRANT DELETE ON agent_penalties TO app_user;
