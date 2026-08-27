import { createSchema } from "graphql-yoga";
import { GraphQLError } from "graphql";
import type { Ctx } from "@/server/context";
import { ForbiddenError } from "@/server/context";
import { adminDashboard, clientHome } from "@/server/services/dashboard";
import {
  listClients, listProjects, listTeam, listInvoices, listSubscriptions, clientHistory,
} from "@/server/services/directory";
import { listThreads, getThread, sendMessage, unreadTotal } from "@/server/services/messaging";
import {
  approveDeliverable, requestRevision, createProjectRequest,
  getMyProfile, updateMyProfile, listServicesPublic,
} from "@/server/services/clientActions";
import { listNotifications, markAllNotificationsRead } from "@/server/services/notifications";
import { globalSearch } from "@/server/services/search";
import {
  createClient, updateClient, getClient, createProject, updateProjectStatus,
  reachProjectStep, createInvoice, markInvoicePaid,
  listProjectRequests, acceptProjectRequest, refuseProjectRequest,
  type ClientInput, type ProjectInput, type InvoiceInput,
} from "@/server/services/adminActions";

export type GqlContext = { ctx: Ctx | null };

/** Every resolver goes through this: no session → UNAUTHENTICATED, always. */
function auth(context: GqlContext): Ctx {
  if (!context.ctx) {
    throw new GraphQLError("Non authentifié.", { extensions: { code: "UNAUTHENTICATED" } });
  }
  return context.ctx;
}

function forbidden(e: unknown): never {
  if (e instanceof ForbiddenError) {
    throw new GraphQLError("Accès refusé.", { extensions: { code: "FORBIDDEN" } });
  }
  throw e;
}

const typeDefs = /* GraphQL */ `
  type Query {
    me: Me!
    adminDashboard(periodDays: Int): AdminDashboard!
    clientHome: ClientHome!
    clients: [ClientRow!]!
    projects: [ProjectRow!]!
    team: [TeamMemberRow!]!
    invoices: [InvoiceRow!]!
    subscriptions: [SubscriptionRow!]!
    history: [HistoryRow!]!
    threads: [ThreadRow!]!
    thread(projectId: ID!): Thread!
    unreadMessages: Int!
    services: [ServiceRow!]!
    myProfile: Profile!
    clientDetail(id: ID!): ClientDetail!
    projectRequests: [RequestRow!]!
    notifications: [NotificationRow!]!
    search(q: String!): [SearchHit!]!
  }

  type Mutation {
    sendMessage(projectId: ID!, body: String!): SentMessage!
    approveDeliverable(fileId: ID!): Boolean!
    requestRevision(fileId: ID!, comment: String!): Boolean!
    createProjectRequest(title: String!, description: String!, serviceId: ID): CreatedRequest!
    updateMyProfile(input: ProfileInput!): Boolean!
    createClient(input: ClientInput!): Created!
    updateClient(id: ID!, input: ClientInput!): Boolean!
    createProject(input: ProjectInput!): Created!
    updateProjectStatus(projectId: ID!, status: String!, comment: String): Boolean!
    reachProjectStep(projectId: ID!, position: Int!): Boolean!
    createInvoice(input: InvoiceInput!): CreatedInvoice!
    markInvoicePaid(invoiceId: ID!, method: String!, reference: String): Boolean!
    acceptProjectRequest(requestId: ID!, price: Float!, dueDate: String): AcceptedRequest!
    refuseProjectRequest(requestId: ID!, note: String): Boolean!
    markNotificationsRead: Boolean!
  }

  type SearchHit { type: String!, title: String!, subtitle: String, badge: String, href: String! }
  type NotificationRow {
    id: ID!, type: String!, title: String!, body: String, href: String!, read: Boolean!, createdAt: String!
  }

  type Created { id: ID! }
  type CreatedInvoice { id: ID!, number: String! }
  type AcceptedRequest { projectId: ID! }
  type ClientDetail {
    id: ID!, companyName: String!, contactName: String!, email: String, phone: String,
    address: String, city: String, taxId: String, billingAddress: String, notes: String
  }
  type RequestRow {
    id: ID!, clientId: ID!, clientCompany: String!, serviceId: ID, serviceName: String,
    title: String!, description: String, byName: String!, status: String!, createdAt: String!
  }
  input ClientInput {
    companyName: String!, contactName: String!, email: String, phone: String,
    address: String, city: String, taxId: String, billingAddress: String, notes: String
  }
  input ProjectInput {
    clientId: ID!, serviceId: ID!, title: String!, description: String,
    price: Float!, startDate: String, dueDate: String, assignedTeamMemberId: ID
  }
  input InvoiceLineInput { description: String!, quantity: Float!, unitPrice: Float! }
  input InvoiceInput {
    clientId: ID!, projectId: ID, dueDate: String, vatRate: Float!, notes: String,
    lines: [InvoiceLineInput!]!
  }

  type Me { userId: ID!, fullName: String!, role: String! }

  type AdminDashboard {
    kpis: AdminKpis!
    revenueByMonth: [MonthRevenue!]!
    revenueByService: [ServiceRevenue!]!
    currentProjects: [DashboardProject!]!
    threads: [ThreadPreview!]!
    invoicesToFollow: [InvoicePreview!]!
  }
  type AdminKpis {
    revenueMonth: Float!, revenueTrendPct: Int, projectsInProgress: Int!,
    newProjectsThisWeek: Int!, unpaidCount: Int!, unpaidTotal: Float!, revisionRequests: Int!
  }
  type MonthRevenue { month: String!, total: Float! }
  type ServiceRevenue { name: String!, color: String, projectCount: Int!, total: Float! }
  type DashboardProject {
    id: ID!, clientCompany: String!, serviceName: String!, status: String!,
    assigneeName: String, dueDate: String, overdue: Boolean!, subtitle: String!
  }
  type ThreadPreview {
    projectId: ID!, clientCompany: String!, projectTitle: String!, serviceName: String!,
    excerpt: String!, senderName: String!, isFromClient: Boolean!, createdAt: String!, unread: Boolean!
  }
  type InvoicePreview { id: ID!, number: String!, clientCompany: String!, status: String!, total: Float! }

  type ClientHome {
    featured: ClientProject
    others: [ClientProject!]!
    unreadCount: Int!
    teamMessages: [TeamMessage!]!
  }
  type ClientProject {
    id: ID!, title: String!, serviceName: String!, status: String!,
    startDate: String, dueDate: String, progress: Int!, pendingInvoices: Int!,
    deliverables: [Deliverable!]!, steps: [Step!]!
  }
  type Deliverable {
    id: ID!, publicId: String!, name: String!, mime: String!, sizeBytes: Float!,
    version: Int!, approval: String, createdAt: String!
  }
  type Step { label: String!, position: Int!, reachedAt: String }
  type TeamMessage {
    projectId: ID!, projectTitle: String!, senderName: String!,
    excerpt: String!, createdAt: String!, unread: Boolean!
  }

  type ClientRow {
    id: ID!, companyName: String!, contactName: String!, email: String, phone: String, city: String,
    activeProjects: Int!, totalProjects: Int!, unpaidTotal: Float!, paidTotal: Float!,
    subscription: String, isActive: Boolean!
  }
  type ProjectRow {
    id: ID!, title: String!, clientCompany: String!, serviceName: String!, price: Float!,
    status: String!, assigneeName: String, startDate: String, dueDate: String, overdue: Boolean!
  }
  type TeamMemberRow {
    id: ID!, fullName: String!, email: String, phone: String, jobTitle: String,
    activeProjects: Int!, totalProjects: Int!, currentWork: [String!]!
  }
  type InvoiceRow {
    id: ID!, number: String!, clientCompany: String!, projectTitle: String, serviceName: String,
    status: String!, issueDate: String!, dueDate: String, subtotal: Float!, vatRate: Float!,
    vatAmount: Float!, total: Float!, lines: [InvoiceLineRow!]!
  }
  type InvoiceLineRow { description: String!, quantity: Float!, unitPrice: Float!, lineTotal: Float! }
  type SubscriptionRow {
    id: ID!, clientCompany: String!, planName: String!, monthlyAmount: Float!, status: String!,
    autoRenew: Boolean!, startDate: String!, renewalDate: String!, renewalSoon: Boolean!
  }
  type HistoryRow {
    id: ID!, title: String!, serviceName: String!, status: String!, price: Float!,
    startDate: String, deliveredAt: String, createdAt: String!, invoicedTotal: Float!
  }
  type ThreadRow {
    projectId: ID!, projectTitle: String!, clientCompany: String!, serviceName: String!,
    lastMessage: String!, lastSenderName: String!, lastAt: String!, unread: Int!
  }
  type Thread { projectId: ID!, projectTitle: String!, messages: [ThreadMessage!]! }
  type ThreadMessage { id: ID!, body: String!, senderName: String!, senderRole: String!, mine: Boolean!, createdAt: String! }
  type SentMessage { id: ID!, createdAt: String! }
  type CreatedRequest { id: ID! }
  type ServiceRow { id: ID!, name: String!, description: String }
  type Profile {
    fullName: String!, email: String!, companyName: String!, contactName: String!,
    phone: String, address: String, city: String, country: String, taxId: String, billingAddress: String
  }
  input ProfileInput {
    fullName: String, phone: String, address: String, city: String, taxId: String, billingAddress: String
  }
`;

const wrap = <T>(fn: () => Promise<T>): Promise<T> => fn().catch(forbidden);

export const schema = createSchema<GqlContext>({
  typeDefs,
  resolvers: {
    Query: {
      me: (_p, _a, c) => {
        const ctx = auth(c);
        return { userId: ctx.userId.toString(), fullName: ctx.fullName, role: ctx.role };
      },
      adminDashboard: (_p, a: { periodDays?: number }, c) => {
        const days = a.periodDays === 7 ? 7 : a.periodDays === 365 ? 365 : 30;
        return wrap(() => adminDashboard(auth(c), days));
      },
      clientHome: (_p, _a, c) => wrap(() => clientHome(auth(c))),
      clients: (_p, _a, c) => wrap(() => listClients(auth(c))),
      projects: (_p, _a, c) => wrap(() => listProjects(auth(c))),
      team: (_p, _a, c) => wrap(() => listTeam(auth(c))),
      invoices: (_p, _a, c) => wrap(() => listInvoices(auth(c))),
      subscriptions: (_p, _a, c) => wrap(() => listSubscriptions(auth(c))),
      history: (_p, _a, c) => wrap(() => clientHistory(auth(c))),
      threads: (_p, _a, c) => wrap(() => listThreads(auth(c))),
      thread: (_p, a: { projectId: string }, c) => wrap(() => getThread(auth(c), BigInt(a.projectId))),
      unreadMessages: (_p, _a, c) => wrap(() => unreadTotal(auth(c))),
      services: () => listServicesPublic(),
      myProfile: (_p, _a, c) => wrap(() => getMyProfile(auth(c))),
      clientDetail: (_p, a: { id: string }, c) => wrap(() => getClient(auth(c), BigInt(a.id))),
      projectRequests: (_p, _a, c) => wrap(() => listProjectRequests(auth(c))),
      notifications: (_p, _a, c) => wrap(() => listNotifications(auth(c))),
      search: (_p, a: { q: string }, c) => wrap(() => globalSearch(auth(c), a.q)),
    },
    Mutation: {
      sendMessage: (_p, a: { projectId: string; body: string }, c) =>
        wrap(() => sendMessage(auth(c), BigInt(a.projectId), a.body)),
      approveDeliverable: (_p, a: { fileId: string }, c) =>
        wrap(() => approveDeliverable(auth(c), BigInt(a.fileId))),
      requestRevision: (_p, a: { fileId: string; comment: string }, c) =>
        wrap(() => requestRevision(auth(c), BigInt(a.fileId), a.comment)),
      createProjectRequest: (_p, a: { title: string; description: string; serviceId?: string }, c) =>
        wrap(() =>
          createProjectRequest(auth(c), {
            title: a.title,
            description: a.description,
            serviceId: a.serviceId ? BigInt(a.serviceId) : null,
          }),
        ),
      updateMyProfile: (
        _p,
        a: { input: { fullName?: string; phone?: string; address?: string; city?: string; taxId?: string; billingAddress?: string } },
        c,
      ) => wrap(() => updateMyProfile(auth(c), a.input)),
      createClient: (_p, a: { input: ClientInput }, c) => wrap(() => createClient(auth(c), a.input)),
      updateClient: (_p, a: { id: string; input: ClientInput }, c) =>
        wrap(() => updateClient(auth(c), BigInt(a.id), a.input)),
      createProject: (_p, a: { input: ProjectInput }, c) => wrap(() => createProject(auth(c), a.input)),
      updateProjectStatus: (_p, a: { projectId: string; status: string; comment?: string }, c) =>
        wrap(() => updateProjectStatus(auth(c), BigInt(a.projectId), a.status, a.comment)),
      reachProjectStep: (_p, a: { projectId: string; position: number }, c) =>
        wrap(() => reachProjectStep(auth(c), BigInt(a.projectId), a.position)),
      createInvoice: (_p, a: { input: InvoiceInput }, c) => wrap(() => createInvoice(auth(c), a.input)),
      markInvoicePaid: (_p, a: { invoiceId: string; method: string; reference?: string }, c) =>
        wrap(() => markInvoicePaid(auth(c), BigInt(a.invoiceId), a.method, a.reference)),
      acceptProjectRequest: (_p, a: { requestId: string; price: number; dueDate?: string }, c) =>
        wrap(() => acceptProjectRequest(auth(c), BigInt(a.requestId), a.price, a.dueDate)),
      refuseProjectRequest: (_p, a: { requestId: string; note?: string }, c) =>
        wrap(() => refuseProjectRequest(auth(c), BigInt(a.requestId), a.note)),
      markNotificationsRead: (_p, _a, c) => wrap(() => markAllNotificationsRead(auth(c))),
    },
  },
});
