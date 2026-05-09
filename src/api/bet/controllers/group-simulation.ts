import type { Core } from '@strapi/strapi';

interface TeamStanding {
  teamId: string;
  teamName: string;
  teamCode: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

function buildStandings(teams: any[], matches: any[], bets: any[]): TeamStanding[] {
  const standingsMap: Record<string, TeamStanding> = {};

  for (const team of teams) {
    standingsMap[team.documentId] = {
      teamId: team.documentId,
      teamName: team.name,
      teamCode: team.code,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    };
  }

  for (const match of matches) {
    const homeTeamId = match.homeTeam?.documentId;
    const awayTeamId = match.awayTeam?.documentId;

    if (!homeTeamId || !awayTeamId) continue;
    if (!standingsMap[homeTeamId] || !standingsMap[awayTeamId]) continue;

    const bet = bets.find((b) => b.match?.documentId === match.documentId);

    let homeGoals: number | null = null;
    let awayGoals: number | null = null;

    if (bet) {
      homeGoals = bet.homeScore;
      awayGoals = bet.awayScore;
    } else if (match.status === 'finished' && match.homeScore != null) {
      homeGoals = match.homeScore;
      awayGoals = match.awayScore;
    }

    if (homeGoals == null || awayGoals == null) continue;

    const home = standingsMap[homeTeamId];
    const away = standingsMap[awayTeamId];

    home.played++;
    away.played++;
    home.goalsFor += homeGoals;
    home.goalsAgainst += awayGoals;
    away.goalsFor += awayGoals;
    away.goalsAgainst += homeGoals;

    if (homeGoals > awayGoals) {
      home.wins++;
      home.points += 3;
      away.losses++;
    } else if (homeGoals < awayGoals) {
      away.wins++;
      away.points += 3;
      home.losses++;
    } else {
      home.draws++;
      away.draws++;
      home.points += 1;
      away.points += 1;
    }
  }

  for (const standing of Object.values(standingsMap)) {
    standing.goalDifference = standing.goalsFor - standing.goalsAgainst;
  }

  return Object.values(standingsMap).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.teamName.localeCompare(b.teamName);
  });
}

const groupSimulation = ({ strapi }: { strapi: Core.Strapi }) => ({
  async simulate(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    let userDocumentId = user.documentId as string | undefined;
    if (!userDocumentId && user.id != null) {
      const found = await strapi.documents('plugin::users-permissions.user').findMany({
        filters: { id: user.id },
        limit: 1,
      });
      userDocumentId = found[0]?.documentId;
    }

    const userFilter =
      userDocumentId != null ? { documentId: userDocumentId } : { id: user.id };

    const teams = (await strapi.documents('api::team.team').findMany({})) as any[];

    const groupMatches = (await strapi.documents('api::match.match').findMany({
      filters: { phase: 'group' } as any,
      populate: ['homeTeam', 'awayTeam'],
    })) as any[];

    const userBets = (await strapi.documents('api::bet.bet').findMany({
      filters: {
        user: userFilter as any,
      },
      populate: ['match'],
    })) as any[];

    const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

    const simulation: Record<string, TeamStanding[]> = {};

    for (const group of groups) {
      const groupTeams = teams.filter((t) => t.group === group);
      const groupMatchesFiltered = groupMatches.filter((m) => m.group === group);

      if (groupTeams.length === 0) continue;

      simulation[group] = buildStandings(groupTeams, groupMatchesFiltered, userBets);
    }

    return ctx.send({ data: simulation });
  },
});

export default groupSimulation;
