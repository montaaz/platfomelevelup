import { createYoga } from "graphql-yoga";
import {
  GraphQLError,
  type ASTVisitor,
  type ValidationContext,
  type DocumentNode,
  Kind,
} from "graphql";
import { schema, type GqlContext } from "@/graphql/schema";
import { getSession } from "@/lib/session";
import { toCtx, isAccountActive } from "@/server/context";

const isProd = process.env.NODE_ENV === "production";
const MAX_DEPTH = 8;

/** Rejects abusively deep queries before execution. */
function depthLimit(context: ValidationContext): ASTVisitor {
  let depth = 0;
  return {
    Field: {
      enter(node) {
        if (node.name.value.startsWith("__")) return;
        depth++;
        if (depth > MAX_DEPTH) {
          context.reportError(new GraphQLError("Requête trop profonde."));
        }
      },
      leave(node) {
        if (node.name.value.startsWith("__")) return;
        depth--;
      },
    },
  };
}

/** Blocks introspection in production. */
function noIntrospection(context: ValidationContext): ASTVisitor {
  return {
    Field(node) {
      if (node.name.value === "__schema" || node.name.value === "__type") {
        context.reportError(new GraphQLError("Introspection désactivée."));
      }
    },
    FragmentDefinition(node) {
      if (node.typeCondition.kind === Kind.NAMED_TYPE) return undefined;
      return undefined;
    },
  };
}

/**
 * Espace équipe (notes de Sarra, §03) : l'API GraphQL sert aussi les
 * factures, commandes et paiements. Un compte EQUIPE n'y a droit qu'à ses
 * opérations personnelles ; tout le reste est refusé avant exécution.
 */
const TEAM_FIELDS = new Set(["changeMyPassword", "markNotificationsRead", "me"]);

function teamAllowed(document: DocumentNode): boolean {
  return document.definitions.every((d) =>
    d.kind !== Kind.OPERATION_DEFINITION ||
    d.selectionSet.selections.every((sel) => sel.kind === Kind.FIELD && (sel.name.value === "__typename" || TEAM_FIELDS.has(sel.name.value))),
  );
}

const yoga = createYoga<object, GqlContext>({
  schema,
  graphqlEndpoint: "/api/graphql",
  graphiql: !isProd,
  landingPage: false,
  batching: false,
  maskedErrors: {
    errorMessage: "Une erreur est survenue. Réessayez ou contactez l'équipe.",
  },
  plugins: [
    {
      onValidate({ addValidationRule }: { addValidationRule: (rule: (ctx: ValidationContext) => ASTVisitor) => void }) {
        addValidationRule(depthLimit);
        if (isProd) addValidationRule(noIntrospection);
      },
      onExecute({ args, setResultAndStopExecution }: { args: { contextValue: GqlContext; document: DocumentNode }; setResultAndStopExecution: (r: { errors: GraphQLError[] }) => void }) {
        if (args.contextValue.ctx?.role === "EQUIPE" && !teamAllowed(args.document)) {
          setResultAndStopExecution({ errors: [new GraphQLError("Accès refusé.")] });
        }
      },
    },
  ],
  context: async () => {
    const session = await getSession();
    if (!session) return { ctx: null };
    const ctx = toCtx(session);
    // Un compte bloqué entre-temps perd la main immédiatement, même si sa
    // session reste valide côté jeton.
    if (!(await isAccountActive(ctx.userId))) return { ctx: null };
    return { ctx };
  },
  fetchAPI: { Response },
});

const handleRequest = (request: Request, ctx: { params: Promise<Record<string, string>> }) =>
  yoga.handleRequest(request, ctx as object);

export { handleRequest as GET, handleRequest as POST };
