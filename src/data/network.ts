export type RoadClass = 'primary' | 'secondary' | 'track';

export interface RoadNode {
  id: string;
  lng: number;
  lat: number;
}

export interface RoadEdge {
  to: string;
  name: string;
  roadClass: RoadClass;
  /** Age of the latest condition report for this segment, in hours. */
  reportAgeH: number;
}

export interface RoadNetwork {
  nodes: Map<string, RoadNode>;
  adjacency: Map<string, RoadEdge[]>;
}

const WEST = -122.47;
const SOUTH = 37.735;
const COLUMNS = 17;
const ROWS = 15;
const STEP_DEGREES = 0.005;

const NORTH_SOUTH_ROADS = [
  'Great Highway',
  'Sunset Boulevard',
  '19th Avenue',
  'Stanyan Street',
  'Divisadero Street',
  'Van Ness Avenue',
  'Mission Street',
  '3rd Street',
] as const;

const EAST_WEST_ROADS = [
  'Brotherhood Way',
  'Cesar Chavez Street',
  '24th Street',
  '16th Street',
  'Market Street',
  'Geary Boulevard',
  'California Street',
  'Bay Street',
] as const;

let cachedNetwork: RoadNetwork | undefined;

function nodeId(column: number, row: number): string {
  return `sf-${column}-${row}`;
}

function roadClass(index: number, count: number): RoadClass {
  if (index % 4 === 0) return 'primary';
  if (index === 1 || index === count - 2) return 'track';
  return 'secondary';
}

function addBidirectionalEdge(
  adjacency: Map<string, RoadEdge[]>,
  from: string,
  to: string,
  name: string,
  classification: RoadClass,
  reportAgeH: number,
): void {
  adjacency.get(from)?.push({
    to,
    name,
    roadClass: classification,
    reportAgeH,
  });
  adjacency.get(to)?.push({
    to: from,
    name,
    roadClass: classification,
    reportAgeH,
  });
}

/**
 * Build a compact connected lattice covering the San Francisco demo area.
 * The graph is generated rather than stored as hundreds of repetitive records,
 * and cached because routing may query it several times in one render.
 */
export function buildNetwork(): RoadNetwork {
  if (cachedNetwork) return cachedNetwork;

  const nodes = new Map<string, RoadNode>();
  const adjacency = new Map<string, RoadEdge[]>();

  for (let row = 0; row < ROWS; row += 1) {
    for (let column = 0; column < COLUMNS; column += 1) {
      const id = nodeId(column, row);
      nodes.set(id, {
        id,
        lng: WEST + column * STEP_DEGREES,
        lat: SOUTH + row * STEP_DEGREES,
      });
      adjacency.set(id, []);
    }
  }

  for (let row = 0; row < ROWS; row += 1) {
    const name = EAST_WEST_ROADS[row % EAST_WEST_ROADS.length];
    const classification = roadClass(row, ROWS);
    const reportAgeH = (row * 7 + 3) % 72;
    for (let column = 0; column < COLUMNS - 1; column += 1) {
      addBidirectionalEdge(
        adjacency,
        nodeId(column, row),
        nodeId(column + 1, row),
        name,
        classification,
        reportAgeH,
      );
    }
  }

  for (let column = 0; column < COLUMNS; column += 1) {
    const name = NORTH_SOUTH_ROADS[column % NORTH_SOUTH_ROADS.length];
    const classification = roadClass(column, COLUMNS);
    const reportAgeH = (column * 5 + 1) % 72;
    for (let row = 0; row < ROWS - 1; row += 1) {
      addBidirectionalEdge(
        adjacency,
        nodeId(column, row),
        nodeId(column, row + 1),
        name,
        classification,
        reportAgeH,
      );
    }
  }

  cachedNetwork = { nodes, adjacency };
  return cachedNetwork;
}
