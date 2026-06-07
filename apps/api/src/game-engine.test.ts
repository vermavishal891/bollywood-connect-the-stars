import assert from 'node:assert/strict';
import {
  calculateModeScore,
  getShortestPath,
  validatePath,
  type GraphNode,
} from './game-engine';

const actorToMovies = new Map<number, number[]>([
  [1, [10, 30]],
  [2, [10, 20]],
  [3, [20, 30]],
]);

const movieToActors = new Map<number, number[]>([
  [10, [1, 2]],
  [20, [2, 3]],
  [30, [1, 3]],
]);

function node(type: GraphNode['type'], id: number): GraphNode {
  return { type, id };
}

const actorPath = getShortestPath(node('actor', 1), node('actor', 3), actorToMovies, movieToActors);
assert.deepEqual(actorPath, [node('actor', 1), node('movie', 30), node('actor', 3)]);

const moviePath = getShortestPath(node('movie', 10), node('movie', 20), actorToMovies, movieToActors);
assert.deepEqual(moviePath, [node('movie', 10), node('actor', 2), node('movie', 20)]);

assert.equal(
  validatePath([node('actor', 1), node('movie', 10), node('actor', 2)], actorToMovies, movieToActors).valid,
  true
);

assert.equal(
  validatePath([node('actor', 1), node('actor', 2)], actorToMovies, movieToActors).valid,
  false
);

const fastSpeedrun = calculateModeScore({
  mode: 'speedrun',
  difficulty: 'medium',
  shortestEdges: 1,
  actualEdges: 1,
  timeTaken: 20,
  hintsUsed: 0,
  isPerfect: true,
});
const slowSpeedrun = calculateModeScore({
  mode: 'speedrun',
  difficulty: 'medium',
  shortestEdges: 1,
  actualEdges: 1,
  timeTaken: 90,
  hintsUsed: 0,
  isPerfect: true,
});
assert.ok(fastSpeedrun > slowSpeedrun);

const perfectShortest = calculateModeScore({
  mode: 'shortest',
  difficulty: 'medium',
  shortestEdges: 2,
  actualEdges: 2,
  timeTaken: 90,
  hintsUsed: 0,
  isPerfect: true,
});
const imperfectShortest = calculateModeScore({
  mode: 'shortest',
  difficulty: 'medium',
  shortestEdges: 2,
  actualEdges: 4,
  timeTaken: 30,
  hintsUsed: 0,
  isPerfect: false,
});
assert.ok(perfectShortest > imperfectShortest);

console.log('game-engine tests passed');
