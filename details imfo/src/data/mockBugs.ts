import type { BugReport } from '../types';

export const mockBugs: BugReport[] = [
  {
    id: 'bug-1',
    title: 'Missing request validation',
    severity: 'High',
    category: 'Backend',
    status: 'Open',
    file: 'backend/routes/auth.py',
    lineRange: '42-58',
    detectedAt: '12 mins ago',
    repositoryId: 'repo-1',
    repositoryName: 'payment-api',
    description: 'Endpoint accepts unverified JSON payloads directly into payment session initialization without schema validation or bounds checking.',
    rootCause: 'The handler extracts `request.get_json()` directly without passing through the Pydantic `PaymentRequestSchema` validator, allowing null amounts or malformed currency codes.',
    suggestedFix: 'Enforce schema validation using Pydantic `PaymentRequestSchema.model_validate` before calling `initiate_checkout_session()`. Return HTTP 422 on validation failure.',
    originalCode: `@router.post("/checkout/session")
async def create_session(request: Request):
    data = await request.json()
    amount = data.get("amount")
    currency = data.get("currency")
    
    # Direct processing without schema verification
    session = payment_service.initiate_checkout_session(
        amount=amount,
        currency=currency,
        account_id=data.get("account_id")
    )
    return {"sessionId": session.id, "status": "pending"}`,
    proposedCode: `@router.post("/checkout/session", response_model=CheckoutSessionResponse)
async def create_session(payload: PaymentRequestSchema):
    # Validated strictly against Pydantic schema
    try:
        session = await payment_service.initiate_checkout_session(
            amount=payload.amount,
            currency=payload.currency.upper(),
            account_id=payload.account_id
        )
        return CheckoutSessionResponse(sessionId=session.id, status="pending")
    except InvalidCurrencyException as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))`,
    verificationStatus: 'Unverified',
  },
  {
    id: 'bug-2',
    title: 'Unhandled API response',
    severity: 'Medium',
    category: 'Frontend',
    status: 'Open',
    file: 'frontend/src/services/api.ts',
    lineRange: '115-132',
    detectedAt: '28 mins ago',
    repositoryId: 'repo-2',
    repositoryName: 'ecommerce-frontend',
    description: 'HTTP response promise does not check `response.ok` before parsing JSON, causing unhandled promise rejections on 4xx/5xx network failures.',
    rootCause: 'Fetch does not reject on non-200 HTTP statuses by default. Calling `response.json()` on an HTML 502/504 error response throws a cryptic JSON syntax error.',
    suggestedFix: 'Add explicit status code inspection `if (!response.ok)` and throw a standardized `ApiError` with response status and error payload.',
    originalCode: `export async function fetchUserCart(cartId: string): Promise<Cart> {
  const response = await fetch(\`/api/v1/carts/\${cartId}\`, {
    headers: { 'Content-Type': 'application/json' },
  });
  
  // Potential uncaught error if server returns 500 HTML
  const data = await response.json();
  return data.cart;
}`,
    proposedCode: `export async function fetchUserCart(cartId: string): Promise<Cart> {
  const response = await fetch(\`/api/v1/carts/\${cartId}\`, {
    headers: { 'Content-Type': 'application/json' },
  });
  
  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'Unknown error');
    throw new ApiError(response.status, \`Failed to fetch cart: \${errorBody}\`);
  }
  
  const data = await response.json();
  return data.cart;
}`,
    verificationStatus: 'Pending Verification',
  },
  {
    id: 'bug-3',
    title: 'Potential SQL injection',
    severity: 'Critical',
    category: 'Security',
    status: 'Open',
    file: 'backend/database/queries.py',
    lineRange: '88-104',
    detectedAt: '35 mins ago',
    repositoryId: 'repo-1',
    repositoryName: 'payment-api',
    description: 'Dynamic raw string concatenation in SQL filter query permits arbitrary SQL injection through the search keyword parameter.',
    rootCause: 'F-string interpolation was utilized instead of parameterized prepared statements when executing tenant-scoped user lookups.',
    suggestedFix: 'Replace raw string formatting with SQLAlchemy/asyncpg parameterized bind variables `:keyword` and `:tenant_id`.',
    originalCode: `async def search_invoices(tenant_id: str, keyword: str):
    # DANGEROUS: direct f-string injection vulnerability
    query = f"""
        SELECT id, invoice_number, total, status
        FROM invoices
        WHERE tenant_id = '{tenant_id}'
        AND invoice_number ILIKE '%{keyword}%'
    """
    return await db.fetch_all(query)`,
    proposedCode: `async def search_invoices(tenant_id: str, keyword: str):
    # SECURE: parameterized prepared statement
    query = """
        SELECT id, invoice_number, total, status
        FROM invoices
        WHERE tenant_id = :tenant_id
        AND invoice_number ILIKE :search_pattern
    """
    return await db.fetch_all(
        query,
        values={"tenant_id": tenant_id, "search_pattern": f"%{keyword}%"}
    )`,
    verificationStatus: 'Unverified',
  },
  {
    id: 'bug-4',
    title: 'Missing error boundary',
    severity: 'Low',
    category: 'Frontend',
    status: 'Open',
    file: 'frontend/src/App.tsx',
    lineRange: '24-38',
    detectedAt: '1 hour ago',
    repositoryId: 'repo-2',
    repositoryName: 'ecommerce-frontend',
    description: 'The root application router lacks a fallback React Error Boundary, leading to white-screen-of-death crashes if any child component throws an unhandled render exception.',
    rootCause: 'Nested child components that render checkout items do not have an error boundary wrapper, causing entire React component tree unmounting.',
    suggestedFix: 'Wrap the top-level route tree with `<GlobalErrorBoundary>` providing graceful recovery and telemetry logging.',
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
    verificationStatus: 'Verified',
  },
  {
    id: 'bug-5',
    title: 'Incorrect authentication middleware',
    severity: 'High',
    category: 'Backend',
    status: 'Open',
    file: 'backend/middleware/auth.js',
    lineRange: '64-79',
    detectedAt: '2 hours ago',
    repositoryId: 'repo-3',
    repositoryName: 'auth-service',
    description: 'Middleware prematurely calls `next()` even when token signature verification returns an expired or invalid status.',
    rootCause: 'Callback error condition was inverted: `if (err && err.name !== "TokenExpiredError") return next(err); next();` allowed expired tokens to proceed to downstream route handlers.',
    suggestedFix: 'Strictly check if error is truthy and halt request processing immediately with 401 Unauthorized.',
    originalCode: `function verifyJwtToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });

  jwt.verify(token, secretKey, (err, decoded) => {
    if (err && err.name !== 'TokenExpiredError') {
      return next(err);
    }
    // BUG: Still calls next() when token has expired!
    req.user = decoded;
    next();
  });
}`,
    proposedCode: `function verifyJwtToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token format' });
  }

  const token = authHeader.split(' ')[1];
  jwt.verify(token, secretKey, (err, decoded) => {
    if (err) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        reason: err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token signature' 
      });
    }
    req.user = decoded;
    next();
  });
}`,
    verificationStatus: 'Verified',
  },
  {
    id: 'bug-6',
    title: 'Hardcoded JWT secret fallback',
    severity: 'Critical',
    category: 'Security',
    status: 'Open',
    file: 'backend/config/security.py',
    lineRange: '15-28',
    detectedAt: '3 hours ago',
    repositoryId: 'repo-1',
    repositoryName: 'payment-api',
    description: 'Default fallback value "super-secret-dev-key" is used when JWT_SECRET environment variable is unset, exposing tokens to offline forgery.',
    rootCause: 'Developers supplied an in-line default string for local testing which persists in container images without environment validation.',
    suggestedFix: 'Enforce application crash on startup if JWT_SECRET is unset in production environment.',
    originalCode: `JWT_SECRET = os.getenv("JWT_SECRET", "super-secret-dev-key-12345")
JWT_ALGORITHM = "HS256"`,
    proposedCode: `JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError("CRITICAL: JWT_SECRET environment variable must be specified!")
JWT_ALGORITHM = "HS256"`,
    verificationStatus: 'Unverified',
  },
  {
    id: 'bug-7',
    title: 'Unbounded memory leak in event listener',
    severity: 'Medium',
    category: 'Frontend',
    status: 'Open',
    file: 'frontend/src/components/LiveFeed.tsx',
    lineRange: '52-67',
    detectedAt: '4 hours ago',
    repositoryId: 'repo-2',
    repositoryName: 'ecommerce-frontend',
    description: '`useEffect` hook registers WebSocket message listeners without cleanup return function, creating duplicate listeners on re-render.',
    rootCause: 'Missing unsubscribe cleanup return from React `useEffect` callback.',
    suggestedFix: 'Return cleanup function invoking `socket.removeEventListener("message", handler)`.',
    originalCode: `useEffect(() => {
  socket.addEventListener("message", handleMessage);
  // Missing cleanup
}, [socket]);`,
    proposedCode: `useEffect(() => {
  socket.addEventListener("message", handleMessage);
  return () => {
    socket.removeEventListener("message", handleMessage);
  };
}, [socket, handleMessage]);`,
    verificationStatus: 'Unverified',
  },
  {
    id: 'bug-8',
    title: 'Race condition in balance deduction',
    severity: 'High',
    category: 'Backend',
    status: 'Open',
    file: 'backend/services/wallet.py',
    lineRange: '77-94',
    detectedAt: '5 hours ago',
    repositoryId: 'repo-1',
    repositoryName: 'payment-api',
    description: 'Concurrent withdrawal requests can overdraft accounts due to read-modify-write pattern without row-level locking.',
    rootCause: 'Selecting balance before updating without `SELECT ... FOR UPDATE` or atomic balance decrement.',
    suggestedFix: 'Use atomic SQL update: `UPDATE wallets SET balance = balance - :amount WHERE id = :id AND balance >= :amount`.',
    originalCode: `async def deduct_balance(wallet_id: str, amount: float):
    wallet = await get_wallet(wallet_id)
    if wallet.balance >= amount:
        new_balance = wallet.balance - amount
        await update_wallet(wallet_id, new_balance)
        return True
    return False`,
    proposedCode: `async def deduct_balance(wallet_id: str, amount: float):
    # Atomic deduction preventing race conditions
    result = await db.execute("""
        UPDATE wallets 
        SET balance = balance - :amount 
        WHERE id = :wallet_id AND balance >= :amount
    """, {"wallet_id": wallet_id, "amount": amount})
    return result.rowcount > 0`,
    verificationStatus: 'Pending Verification',
  },
  {
    id: 'bug-9',
    title: 'CORS wildcard misconfiguration',
    severity: 'High',
    category: 'Security',
    status: 'Open',
    file: 'backend/main.py',
    lineRange: '30-41',
    detectedAt: '6 hours ago',
    repositoryId: 'repo-3',
    repositoryName: 'auth-service',
    description: 'Access-Control-Allow-Origin is configured as wildcard `*` while `allow_credentials=True` is enabled.',
    rootCause: 'Permissive development CORS setup was inadvertently deployed to staging configuration.',
    suggestedFix: 'Explicitly specify allowed trusted origin domains and reject unlisted origins.',
    originalCode: `app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)`,
    proposedCode: `ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "https://app.codelens.ai").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)`,
    verificationStatus: 'Verified',
  },
  {
    id: 'bug-10',
    title: 'N+1 database query in product list',
    severity: 'Medium',
    category: 'Backend',
    status: 'Open',
    file: 'backend/services/catalog.py',
    lineRange: '105-120',
    detectedAt: '8 hours ago',
    repositoryId: 'repo-2',
    repositoryName: 'ecommerce-frontend',
    description: 'Iterating over products and executing individual queries for category tags causes severe latency spikes under load.',
    rootCause: 'Lazy loading relationship inside list comprehension loop instead of eager loading.',
    suggestedFix: 'Use `selectinload` or joined table load to fetch product tags in a single batch query.',
    originalCode: `products = await session.execute(select(Product))
result = []
for p in products.scalars():
    tags = await session.execute(select(Tag).filter_by(product_id=p.id))
    result.append({ "product": p, "tags": tags.scalars().all() })`,
    proposedCode: `query = select(Product).options(selectinload(Product.tags))
products = await session.execute(query)
return products.scalars().all()`,
    verificationStatus: 'Unverified',
  },
  {
    id: 'bug-11',
    title: 'DOM XSS via dangerouslySetInnerHTML',
    severity: 'Critical',
    category: 'Security',
    status: 'Open',
    file: 'frontend/src/components/ReviewSnippet.tsx',
    lineRange: '18-29',
    detectedAt: '9 hours ago',
    repositoryId: 'repo-2',
    repositoryName: 'ecommerce-frontend',
    description: 'User-submitted product review descriptions are injected directly without HTML sanitization or escaping.',
    rootCause: 'Using `dangerouslySetInnerHTML` on untrusted user strings enables persistent script execution.',
    suggestedFix: 'Sanitize with DOMPurify or render as plain escaped text content.',
    originalCode: `export function ReviewSnippet({ review }: { review: Review }) {
  return (
    <div className="review-box">
      <h4 className="font-semibold">{review.author}</h4>
      <div dangerouslySetInnerHTML={{ __html: review.content }} />
    </div>
  );
}`,
    proposedCode: `import DOMPurify from 'dompurify';

export function ReviewSnippet({ review }: { review: Review }) {
  const sanitizedContent = DOMPurify.sanitize(review.content);
  return (
    <div className="review-box">
      <h4 className="font-semibold">{review.author}</h4>
      <div dangerouslySetInnerHTML={{ __html: sanitizedContent }} />
    </div>
  );
}`,
    verificationStatus: 'Verified',
  },
  {
    id: 'bug-12',
    title: 'Unoptimized re-renders on telemetry polling',
    severity: 'Low',
    category: 'Frontend',
    status: 'Open',
    file: 'frontend/src/pages/Analytics.tsx',
    lineRange: '74-88',
    detectedAt: 'Yesterday',
    repositoryId: 'repo-4',
    repositoryName: 'analytics-dashboard',
    description: 'Component re-creates chart datasets on every 1-second interval, triggering excessive re-renders of the entire dashboard grid.',
    rootCause: 'Missing memoization with `useMemo` on aggregated time-series calculation.',
    suggestedFix: 'Memoize processed chart dataset and memoize child chart components with `React.memo`.',
    originalCode: `const processedData = rawEvents.map(event => ({
  time: event.timestamp,
  count: event.metricValue * multiplier
}));`,
    proposedCode: `const processedData = useMemo(() => {
  return rawEvents.map(event => ({
    time: event.timestamp,
    count: event.metricValue * multiplier
  }));
}, [rawEvents, multiplier]);`,
    verificationStatus: 'Verified',
  },
];
