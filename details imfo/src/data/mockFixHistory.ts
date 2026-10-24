import type { FixHistoryItem } from '../types';

export const mockFixHistory: FixHistoryItem[] = [
  {
    id: 'fix-1',
    bugId: 'bug-4',
    issueTitle: 'Missing error boundary',
    repositoryName: 'ecommerce-frontend',
    date: '2 hours ago',
    fixStatus: 'Applied',
    verificationStatus: 'Verified',
    author: 'CodeLens AI (Auto-PR #88)',
    commitMessage: 'fix(router): wrap root view in GlobalErrorBoundary',
    file: 'frontend/src/App.tsx',
    originalCode: `export function App() {
  return (
    <ThemeProvider>
      <RouterProvider router={appRouter} />
    </ThemeProvider>
  );
}`,
    proposedCode: `export function App() {
  return (
    <ThemeProvider>
      <GlobalErrorBoundary fallback={<AppCrashFallback />}>
        <RouterProvider router={appRouter} />
      </GlobalErrorBoundary>
    </ThemeProvider>
  );
}`,
  },
  {
    id: 'fix-2',
    bugId: 'bug-5',
    issueTitle: 'Incorrect authentication middleware',
    repositoryName: 'auth-service',
    date: '3 hours ago',
    fixStatus: 'Applied',
    verificationStatus: 'Verified',
    author: 'sarah.dev',
    commitMessage: 'security(auth): strictly enforce 401 when token verification fails',
    file: 'backend/middleware/auth.js',
    originalCode: `jwt.verify(token, secretKey, (err, decoded) => {
  if (err && err.name !== 'TokenExpiredError') {
    return next(err);
  }
  req.user = decoded;
  next();
});`,
    proposedCode: `jwt.verify(token, secretKey, (err, decoded) => {
  if (err) {
    return res.status(401).json({ error: 'Unauthorized', message: err.message });
  }
  req.user = decoded;
  next();
});`,
  },
  {
    id: 'fix-3',
    bugId: 'bug-9',
    issueTitle: 'CORS wildcard misconfiguration',
    repositoryName: 'auth-service',
    date: '5 hours ago',
    fixStatus: 'Applied',
    verificationStatus: 'Verified',
    author: 'marcus.k',
    commitMessage: 'fix(security): restrict CORS origins to whitelisted domain',
    file: 'backend/main.py',
    originalCode: `allow_origins=["*"]`,
    proposedCode: `allow_origins=os.getenv("ALLOWED_ORIGINS").split(",")`,
  },
  {
    id: 'fix-4',
    bugId: 'bug-11',
    issueTitle: 'DOM XSS via dangerouslySetInnerHTML',
    repositoryName: 'ecommerce-frontend',
    date: '1 day ago',
    fixStatus: 'Applied',
    verificationStatus: 'Verified',
    author: 'alex.tan',
    commitMessage: 'fix(xss): sanitize user review HTML via DOMPurify',
    file: 'frontend/src/components/ReviewSnippet.tsx',
    originalCode: `<div dangerouslySetInnerHTML={{ __html: review.content }} />`,
    proposedCode: `const sanitized = DOMPurify.sanitize(review.content);
<div dangerouslySetInnerHTML={{ __html: sanitized }} />`,
  },
  {
    id: 'fix-5',
    bugId: 'bug-2',
    issueTitle: 'Unhandled API response in cart service',
    repositoryName: 'ecommerce-frontend',
    date: '1 day ago',
    fixStatus: 'Reviewing',
    verificationStatus: 'Pending',
    author: 'CodeLens AI',
    commitMessage: 'refactor(api): add status verification before JSON parsing',
    file: 'frontend/src/services/api.ts',
    originalCode: `const data = await response.json();
return data.cart;`,
    proposedCode: `if (!response.ok) {
  throw new ApiError(response.status, 'Failed to fetch cart');
}
return (await response.json()).cart;`,
  },
  {
    id: 'fix-6',
    bugId: 'bug-8',
    issueTitle: 'Race condition in balance deduction',
    repositoryName: 'payment-api',
    date: '2 days ago',
    fixStatus: 'Reviewing',
    verificationStatus: 'Pending',
    author: 'elena.rodriguez',
    commitMessage: 'fix(wallet): atomic balance decrement with conditional guard',
    file: 'backend/services/wallet.py',
    originalCode: `wallet = await get_wallet(id)
if wallet.balance >= amount:
    await update_wallet(id, wallet.balance - amount)`,
    proposedCode: `await db.execute("UPDATE wallets SET balance = balance - :amt WHERE id = :id AND balance >= :amt")`,
  },
];
