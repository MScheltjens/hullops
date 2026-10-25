import {
  parse,
  type GraphQLResolveInfo,
  type OperationDefinitionNode,
} from 'graphql';
import { orderIncludeFor, requestedFields } from './order-selection';

/** A resolve info for the first field of a query, enough for these tests. */
function infoFor(query: string): GraphQLResolveInfo {
  const document = parse(query);
  const operation = document.definitions.find(
    (d): d is OperationDefinitionNode => d.kind === 'OperationDefinition',
  );
  const fragments = Object.fromEntries(
    document.definitions
      .filter((d) => d.kind === 'FragmentDefinition')
      .map((d) => [(d as { name: { value: string } }).name.value, d]),
  );
  return {
    fieldNodes: [operation!.selectionSet.selections[0]],
    fragments,
  } as unknown as GraphQLResolveInfo;
}

describe('requestedFields', () => {
  it('lists the fields asked for directly under the query', () => {
    const info = infoFor('{ orders { id title vessel { name } team { id } } }');
    expect([...requestedFields(info)].sort()).toEqual([
      'id',
      'team',
      'title',
      'vessel',
    ]);
  });

  it('does not list fields nested deeper', () => {
    const fields = requestedFields(infoFor('{ order { vessel { name } } }'));
    expect(fields.has('vessel')).toBe(true);
    expect(fields.has('name')).toBe(false);
  });

  it('follows inline fragments and named fragments', () => {
    const info = infoFor(`
      query { orders { id ... on Order { team { id } } ...More } }
      fragment More on Order { history { status } commentCount }
    `);
    expect([...requestedFields(info)].sort()).toEqual([
      'commentCount',
      'history',
      'id',
      'team',
    ]);
  });
});

describe('orderIncludeFor', () => {
  it('loads nothing extra for plain fields', () => {
    expect(orderIncludeFor(new Set(['id', 'title', 'overdue']))).toEqual({});
  });

  it('loads the vessel and the team for the overview, and only counts comments', () => {
    const include = orderIncludeFor(
      new Set(['id', 'vessel', 'team', 'commentCount']),
    );
    expect(Object.keys(include).sort()).toEqual([
      '_count',
      'assignments',
      'vessel',
    ]);
    expect(include._count).toEqual({ select: { comments: true } });
  });

  it('does not load history or comments for the overview', () => {
    const include = orderIncludeFor(
      new Set(['vessel', 'team', 'commentCount']),
    );
    expect(include).not.toHaveProperty('statusUpdates');
    expect(include).not.toHaveProperty('comments');
  });

  it('loads the comments themselves, not just a count, when they are asked for', () => {
    const include = orderIncludeFor(new Set(['comments', 'commentCount']));
    expect(include).toHaveProperty('comments');
    expect(include).not.toHaveProperty('_count');
  });

  it('loads history, details and the creator for the detail page', () => {
    const include = orderIncludeFor(
      new Set(['history', 'createdBy', 'cleaningDetails', 'protectionDetails']),
    );
    expect(Object.keys(include).sort()).toEqual([
      'cleaningDetails',
      'createdBy',
      'protectionDetails',
      'statusUpdates',
    ]);
  });
});
