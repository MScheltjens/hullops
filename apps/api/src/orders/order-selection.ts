import { Kind } from 'graphql';
import type { GraphQLResolveInfo, SelectionSetNode } from 'graphql';
import type { Prisma } from '../generated/prisma/client';

/**
 * Loading only what a query asks for.
 *
 * An order's history, comments and team are separate tables. Loading all of
 * them for every order in a list is wasteful: the order overview only needs
 * the title, the vessel, the team and the *number* of comments, yet the
 * history and every comment with its author would be fetched, and that grows
 * with each note anyone writes. So the list and detail queries look at which
 * fields were requested and load just those relations.
 */

/** The names of the fields requested directly under the field being resolved. */
export function requestedFields(info: GraphQLResolveInfo): Set<string> {
  const names = new Set<string>();
  const visit = (selectionSet: SelectionSetNode | undefined) => {
    for (const selection of selectionSet?.selections ?? []) {
      if (selection.kind === Kind.FIELD) {
        names.add(selection.name.value);
      } else if (selection.kind === Kind.INLINE_FRAGMENT) {
        visit(selection.selectionSet);
      } else {
        // A named fragment (`...OrderFields`).
        visit(info.fragments[selection.name.value]?.selectionSet);
      }
    }
  };
  for (const node of info.fieldNodes) visit(node.selectionSet);
  return names;
}

/** The relations to load for the given requested fields, and nothing more. */
export function orderIncludeFor(
  fields: ReadonlySet<string>,
): Prisma.OrderInclude {
  const include: Prisma.OrderInclude = {};
  if (fields.has('vessel')) include.vessel = true;
  if (fields.has('createdBy')) include.createdBy = true;
  if (fields.has('cleaningDetails')) include.cleaningDetails = true;
  if (fields.has('protectionDetails')) include.protectionDetails = true;
  if (fields.has('team')) {
    // Team sorted by name: members added together share the same assignedAt.
    include.assignments = {
      include: { user: true },
      orderBy: { user: { name: 'asc' } },
    };
  }
  if (fields.has('history')) {
    include.statusUpdates = {
      include: { author: true },
      orderBy: { createdAt: 'asc' },
    };
  }
  if (fields.has('comments')) {
    include.comments = {
      include: { author: true },
      orderBy: { createdAt: 'asc' },
    };
  } else if (fields.has('commentCount')) {
    // Just the number: the database counts, the comments aren't sent.
    include._count = { select: { comments: true } };
  }
  return include;
}
