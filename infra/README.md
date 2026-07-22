# Infrastructure approval boundary

Infrastructure code intentionally starts empty in Section 1.

Do not add or deploy AWS resources until the user approves a resource-and-cost packet covering the diff, one-time cost, monthly cost, worst-case exposure, credit eligibility, rollback, and applicable payment/provider approvals. CI must remain non-deploying and deployment credentials must not be added to ordinary workflows.
