# Architecture Reference

This document captures architectural decisions, patterns, and deviations from traditional Clean Architecture for a pragmatic TypeScript monorepo.

---

## Table of Contents

1. [Philosophy](#philosophy)
2. [Service Types](#service-types)
3. [Repository Pattern](#repository-pattern)
4. [Factory + Singleton Pattern](#factory--singleton-pattern)
5. [Monorepo Structure](#monorepo-structure)
6. [Dependency Graph](#dependency-graph)
7. [Orchestration Patterns](#orchestration-patterns)
8. [Testing Strategy](#testing-strategy)
9. [Deviations from Clean Architecture](#deviations-from-clean-architecture)
10. [Multiple Data Sources](#multiple-data-sources)

---

## Philosophy

This architecture optimizes for **TypeScript pragmatism** over OOP purity. Key principles:

- Prefer type inference over explicit interfaces where safe
- Prefer functions and factories over classes
- Prefer co-location over separation of interface/implementation
- Accept single-implementation assumptions while preserving testability
- Keep domain logic pure; keep orchestration in application services

---

## Service Types

### Application Service (Use Case)

**Purpose**: Orchestrate a complete user-facing operation across multiple entities and repositories.

**Characteristics**:
- Handles I/O (repository calls, external services)
- Manages transaction boundaries
- Contains workflow logic, not business rules
- Named after actions: `processOrder`, `registerUser`, `sendInvoice`

**Responsibilities**:
- Fetch entities from repositories
- Call domain services for business logic
- Persist results
- Coordinate multi-step operations

```typescript
// /packages/services/processOrder.ts
export const createProcessOrder = (deps: {
  orderRepo: OrderRepository;
  userRepo: UserRepository;
  pricing: PricingCalculator;
}) => async (orderId: string): Promise<OrderSummary> => {
  const order = await deps.orderRepo.findById(orderId);
  const user = await deps.userRepo.findById(order.userId);

  const summary = deps.pricing.calculateTotal(order, user);

  await deps.orderRepo.save({ ...order, total: summary.total, status: "priced" });
  return summary;
};
```

### Domain Service

**Purpose**: Encapsulate business logic that doesn't belong to a single entity.

**Characteristics**:
- Pure functions—no I/O, no side effects
- Receives fully-loaded entities as parameters
- Returns computed results or new entity states
- Named after business concepts: `PricingCalculator`, `EligibilityChecker`

**Responsibilities**:
- Apply business rules across multiple entities
- Calculate derived values
- Make business decisions
- Return what *should* happen, not *make* it happen

```typescript
// /packages/domain/pricingCalculator.ts
export const createPricingCalculator = () => ({
  calculateTotal: (order: Order, user: User): OrderSummary => {
    const subtotal = sumLineItems(order.items);
    const discount = resolveDiscount(user.tier, subtotal);
    const tax = calculateTax(subtotal - discount, order.shippingAddress);

    return { orderId: order.id, subtotal, discount, tax, total: subtotal - discount + tax };
  },
});
```

### Infrastructure Service

**Purpose**: Wrap external systems and technical concerns behind clean interfaces.

**Characteristics**:
- Lives in infrastructure packages
- Implements technical integrations (email, storage, external APIs)
- Provides clean interfaces to messy external systems
- Named after capabilities: `EmailService`, `StorageService`, `PaymentGateway`

**Responsibilities**:
- Translate between domain types and external system formats
- Handle retries, timeouts, and error mapping
- Isolate third-party SDK details from the rest of the codebase

```typescript
// /packages/infra/emailService.ts
import { SomeEmailSDK } from 'some-email-sdk';

export const createEmailService = (sdk: SomeEmailSDK) => ({
  sendOrderConfirmation: async (to: string, order: Order): Promise<void> => {
    await sdk.send({
      to,
      templateId: 'order-confirmation',
      data: { orderId: order.id, total: order.total, items: order.items },
    });
  },

  sendPasswordReset: async (to: string, resetToken: string): Promise<void> => {
    await sdk.send({
      to,
      templateId: 'password-reset',
      data: { resetLink: `https://example.com/reset?token=${resetToken}` },
    });
  },
});

export type EmailService = ReturnType<typeof createEmailService>;
```

**Key Distinction**: Infrastructure Services wrap *external systems*; Domain Services contain *business logic*. If you're writing business `if` statements, it's a Domain Service. If you're translating between your domain and an external API, it's an Infrastructure Service.

---

## Repository Pattern

### Traditional Clean Architecture

```
Domain Layer:     interface OrderRepository { ... }
Infrastructure:   class PostgresOrderRepository implements OrderRepository
```

### Recommended Approach: Co-located Factory + Inferred Type

```typescript
// /packages/db/orderRepo.ts
export const createOrderRepo = (pg: PgClient) => ({
  findById: async (id: string): Promise<Order | null> => {
    const row = await pg.query('SELECT * FROM orders WHERE id = $1', [id]);
    return row ? toDomain(row) : null;
  },

  findByUser: async (userId: string): Promise<Order[]> => {
    const rows = await pg.query('SELECT * FROM orders WHERE user_id = $1', [userId]);
    return rows.map(toDomain);
  },

  save: async (order: Order): Promise<void> => {
    await pg.query(
      'INSERT INTO orders (id, user_id, total, status) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET total = $3, status = $4',
      [order.id, order.userId, order.total, order.status]
    );
  },
});

export type OrderRepository = ReturnType<typeof createOrderRepo>;
```

### Why This Works

1. **Type safety preserved**: TypeScript infers a precise type from the factory
2. **Single source of truth**: Type and implementation can't drift apart
3. **Less boilerplate**: No separate interface file
4. **Still injectable**: Factory accepts dependencies, enabling test doubles

### Trade-offs Accepted

| Benefit Lost | Mitigation |
|--------------|------------|
| Explicit contract definition | Annotate return types on methods for stability |
| Compile-time interface conformance | Tests catch implementation errors |
| Separation of concerns | Pragmatic choice for single-implementation scenario |
| Accidental API expansion | Discipline: don't return internal helpers |

### Best Practice: Annotate Method Return Types

```typescript
// Good: Explicit return types prevent accidental contract changes
export const createOrderRepo = (pg: PgClient) => ({
  findById: async (id: string): Promise<Order | null> => { ... },
  save: async (order: Order): Promise<void> => { ... },
});

// Risky: Inferred returns can change unexpectedly
export const createOrderRepo = (pg: PgClient) => ({
  findById: async (id: string) => { ... },  // Return type inferred
});
```

---

## Factory + Singleton Pattern

Every injectable dependency follows this pattern:

```typescript
// 1. Factory function (for testing, custom instances)
export const createOrderRepo = (pg: PgClient) => ({
  findById: async (id: string): Promise<Order | null> => { ... },
  save: async (order: Order): Promise<void> => { ... },
});

// 2. Inferred type export
export type OrderRepository = ReturnType<typeof createOrderRepo>;

// 3. Default singleton (for normal usage)
import { pgClient } from './client';
export const orderRepo = createOrderRepo(pgClient);
```

### Usage Patterns

**Production code** uses singletons:

```typescript
import { orderRepo } from '@packages/db/orderRepo';

const order = await orderRepo.findById(id);
```

**Tests** use factories:

```typescript
import { createOrderRepo } from '@packages/db/orderRepo';

const mockPg = createMockPgClient();
const orderRepo = createOrderRepo(mockPg);
```

**Application services** expose both:

```typescript
// /packages/services/processOrder.ts
import { orderRepo } from '@packages/db/orderRepo';
import { userRepo } from '@packages/db/userRepo';
import { createPricingCalculator } from '@packages/domain/pricingCalculator';

// Factory for injection
export const createProcessOrder = (deps: {
  orderRepo: OrderRepository;
  userRepo: UserRepository;
  pricing: ReturnType<typeof createPricingCalculator>;
}) => async (orderId: string): Promise<OrderSummary> => {
  // Implementation
};

// Default singleton
export const processOrder = createProcessOrder({
  orderRepo,
  userRepo,
  pricing: createPricingCalculator(),
});
```

### Singleton Considerations

| Concern | Mitigation |
|---------|------------|
| Test isolation | Use factories in tests; reset singletons if needed |
| Hidden dependencies | Accept this trade-off for convenience |
| Initialization order | Keep singleton dependencies simple and acyclic |

---

## Monorepo Structure

Packages are organized by **architectural layer**, not by feature. Each package has a clear responsibility and a strict set of allowed imports.

### Package Responsibilities

#### `/packages/model`
- Zod schemas for all business entities
- TypeScript type exports derived from schemas
- Value objects
- Shared constants and enums
- **No business logic, no I/O**

#### `/packages/domain`
- Pure domain services
- Business rule implementations
- Calculators, validators, eligibility checkers
- **Receives entities, returns results—never touches repositories**

#### `/packages/services`
- Application services (use cases)
- Orchestration of domain logic and repository calls
- Shared across multiple apps
- **Contains workflow logic, not business rules**

#### `/packages/db`
- Database client configuration
- Repository implementations
- Repository type exports (`ReturnType<typeof createXRepo>`)
- Database migrations (if applicable)

#### `/apps/*`
- Application entry points (web server, worker, CLI, etc.)
- HTTP controllers/routes, job handlers, command definitions
- Request/response handling, authentication middleware
- App-specific wiring (if needed beyond singletons)

---

## Dependency Graph

```
        app-a               app-b
           \                   /
            \                 /
             v               v
              \             /
               \           /
                v         v
                 services
                /    |
               /     |
              v      v
          domain    db
              \      |
               \     |
                v    v
                  model
```

### Dependency Rules

| Package | Can Import From |
|---------|-----------------|
| `model` | (nothing—leaf package) |
| `domain` | `model` |
| `db` | `model` |
| `services` | `model`, `domain`, `db` |
| `apps/*` | `services`, `model` (avoid direct `db` imports) |

### Forbidden Dependencies

- `domain` must NEVER import from `db`
- `model` must NEVER import from any other package

---

## Orchestration Patterns

### Standard Flow

Application service fetches, domain service calculates, application service persists:

```typescript
export const createProcessOrder = (deps) => async (orderId: string) => {
  const order = await deps.orderRepo.findById(orderId);
  const user = await deps.userRepo.findById(order.userId);

  const summary = deps.pricing.calculateTotal(order, user);

  await deps.orderRepo.save({ ...order, total: summary.total, status: "priced" });
  return summary;
};
```

### When Logic Lives Where

| Type of Logic | Location | Example |
|---------------|----------|---------|
| What constitutes a "premium" user | Domain Service | `if (totalSpent > 10000 && accountAge > 365)` |
| Which repository to write to | Application Service | `await orderRepo.save(...)` |
| How to calculate a discount | Domain Service | `discount = tier === "gold" ? 0.15 : 0` |
| Whether to also send a notification | Application Service | `if (result.isLargeOrder) notify()` |
| What "large order" means | Domain (as property) | `get isLargeOrder() { return total > 500 }` |

---

## Testing Strategy

### Unit Testing Domain Services

Domain services are pure—test with plain objects, no mocks needed:

```typescript
describe('PricingCalculator', () => {
  const pricing = createPricingCalculator();

  it('applies gold tier discount', () => {
    const order = createOrder({ items: [{ price: 100, qty: 2 }] });
    const user = createUser({ tier: 'gold' });

    const result = pricing.calculateTotal(order, user);

    expect(result.discount).toBe(30); // 15% of 200
  });
});
```

### Unit Testing Application Services

Use factories to inject mock repositories:

```typescript
describe('processOrder', () => {
  it('prices the order and persists', async () => {
    const mockOrderRepo = {
      findById: vi.fn().mockResolvedValue(mockOrder),
      save: vi.fn(),
    };
    const mockUserRepo = {
      findById: vi.fn().mockResolvedValue(mockUser),
    };
    const mockPricing = {
      calculateTotal: vi.fn().mockReturnValue(mockSummary),
    };

    const processOrder = createProcessOrder({
      orderRepo: mockOrderRepo,
      userRepo: mockUserRepo,
      pricing: mockPricing,
    });

    const result = await processOrder('order-123');

    expect(mockOrderRepo.findById).toHaveBeenCalledWith('order-123');
    expect(mockOrderRepo.save).toHaveBeenCalled();
    expect(result).toEqual(mockSummary);
  });
});
```

### Integration Testing Repositories

Test against real (or containerized) databases:

```typescript
describe('OrderRepository', () => {
  const pg = createTestPgClient();
  const repo = createOrderRepo(pg);

  beforeEach(() => pg.query('TRUNCATE orders'));

  it('saves and retrieves orders', async () => {
    await repo.save(testOrder);
    const found = await repo.findById(testOrder.id);
    expect(found).toEqual(testOrder);
  });
});
```

---

## Deviations from Clean Architecture

### 1. No Explicit Repository Interfaces

**Traditional**: Define `interface OrderRepository` in domain, implement in infrastructure.

**This approach**: `ReturnType<typeof createOrderRepo>` defines the type alongside implementation.

**When to use**: When you expect a single implementation per repository and want to minimize boilerplate. TypeScript inference provides equivalent type safety.

**Trade-off**: Type is coupled to infrastructure package. Moving an entity to a different database requires updating imports.

### 2. Repository Types Live in Infrastructure

**Traditional**: Repository interfaces in domain layer, implementations in infrastructure.

**This approach**: Repository types exported from `db` packages.

**When to use**: When co-location is more valuable than strict layer separation. Avoids interface/implementation file proliferation.

**Trade-off**: `services` package imports types from infrastructure packages.

### 3. Singletons for Default Instances

**Traditional**: Dependency injection container wires dependencies at application startup.

**This approach**: Each factory exports a singleton using default configuration.

**When to use**: When you want a simpler mental model without DI container overhead, while still retaining factory-based testing.

**Trade-off**: Hidden dependencies in consumer code; need discipline for test isolation.

### 4. Application Services in Shared Package

**Traditional**: Application layer is per-application; use cases are app-specific.

**This approach**: `/packages/services` shared across all apps.

**When to use**: When multiple apps execute the same business operations and you want to avoid duplication.

**Trade-off**: Use cases are coupled across apps; changes to a use case affect all consumers.

### 5. No Ports/Adapters Package Structure

**Traditional**: Explicit `ports` and `adapters` directories separating contracts from implementations.

**This approach**: Flat structure organized by infrastructure type (`db`, `infra`).

**When to use**: When simpler navigation and fewer indirection layers are preferred. Matches TypeScript ecosystem conventions.

**Trade-off**: Less explicit architectural boundaries; relies on team discipline.

---

## Decision Summary

| Decision | Clean Architecture | This Approach | Reason |
|----------|-------------------|---------------|--------|
| Repository interfaces | Separate interface file | `ReturnType<typeof create...>` | Less boilerplate, TypeScript-native |
| Interface location | Domain layer | Infrastructure package | Co-location, single implementation |
| Dependency injection | DI container | Factory + singleton | Simpler, sufficient for most projects |
| Application services | Per-app | Shared package | Multiple apps share use cases |
| Package structure | Ports/adapters | By infrastructure type | Pragmatic, easier navigation |

---

## Quick Reference

### Creating a New Repository

```typescript
// /packages/db/newEntityRepo.ts
import { pgClient } from './client';
import { NewEntity } from '@packages/model';

export const createNewEntityRepo = (pg: PgClient) => ({
  findById: async (id: string): Promise<NewEntity | null> => { ... },
  save: async (entity: NewEntity): Promise<void> => { ... },
});

export type NewEntityRepository = ReturnType<typeof createNewEntityRepo>;
export const newEntityRepo = createNewEntityRepo(pgClient);
```

### Creating a New Domain Service

```typescript
// /packages/domain/newCalculator.ts
import { EntityA, EntityB, Result } from '@packages/model';

export const createNewCalculator = () => ({
  calculate: (a: EntityA, b: EntityB): Result => {
    // Pure business logic
  },
});

export type NewCalculator = ReturnType<typeof createNewCalculator>;
```

### Creating a New Application Service

```typescript
// /packages/services/newUseCase.ts
import { entityARepo } from '@packages/db/entityARepo';
import { createNewCalculator, NewCalculator } from '@packages/domain/newCalculator';

type Deps = {
  entityARepo: EntityARepository;
  calculator: NewCalculator;
};

export const createNewUseCase = (deps: Deps) => async (input: Input): Promise<Output> => {
  const a = await deps.entityARepo.findById(input.aId);

  const result = deps.calculator.calculate(a);

  await deps.entityARepo.save(result.updatedA);
  return result;
};

export const newUseCase = createNewUseCase({
  entityARepo,
  calculator: createNewCalculator(),
});
```

---

## Multiple Data Sources

When your project grows to include a second data store (data warehouse, cache, external API), extend the architecture as follows:

### Additional Data Package

Add a sibling to `/packages/db`:

```
/packages/db       → Primary database (e.g., Postgres)
/packages/dwh      → Data warehouse (e.g., Snowflake, BigQuery)
/packages/cache    → Cache layer (e.g., Redis)
```

Each data package follows the same factory + singleton pattern and depends only on `model`.

### Extended Dependency Graph

```
                 services
                /   |    \
               /    |     \
              v     v      v
          domain   db     dwh
              \     |      /
               \    |     /
                v   v    v
                  model
```

### Additional Rules

- Data packages must NEVER import from each other (`db` cannot import `dwh` and vice versa)
- `services` may import from all data packages to coordinate cross-database operations
- Multi-database writes require explicit coordination in the application service:

```typescript
export const createPlaceOrderAndArchive = (deps) => async (orderId: string) => {
  const order = await deps.orderRepo.findById(orderId);      // from primary DB
  const analytics = await deps.analyticsRepo.getContext(orderId); // from DWH

  const result = deps.pricing.calculateTotal(order, analytics);

  await deps.orderRepo.save(result.updatedOrder);              // to primary DB
  await deps.analyticsRepo.recordOrder(result);                 // to DWH
};
```
