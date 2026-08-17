import { StatusAPIEndpoints } from '#claude-down/lib/anthropic/endpoints';

const statusApiResources = [
	'summary',
	'status',
	'components',
	'incidents',
	'incidents/unresolved',
	'scheduled-maintenances',
	'scheduled-maintenances/active',
	'scheduled-maintenances/upcoming',
] as const;

type StatusApiResource = (typeof statusApiResources)[number];

const statusApiResourceDescriptions: Record<StatusApiResource, string> = {
	components: 'All components and their current operational statuses',
	incidents: 'Recent incidents, including resolved incidents',
	'incidents/unresolved': 'Currently unresolved incidents',
	'scheduled-maintenances': 'All scheduled maintenances',
	'scheduled-maintenances/active': 'Currently active scheduled maintenances',
	'scheduled-maintenances/upcoming': 'Upcoming scheduled maintenances',
	status: 'Current page-wide status indicator and description',
	summary: 'Status, components, unresolved incidents, and maintenances',
};

function statusApiResourceList() {
	return statusApiResources.map((endpoint) => ({
		endpoint,
		description: statusApiResourceDescriptions[endpoint],
	}));
}

function statusApiEndpoint(resource: StatusApiResource): string {
	switch (resource) {
		case 'summary':
			return StatusAPIEndpoints.summary();
		case 'status':
			return StatusAPIEndpoints.status();
		case 'components':
			return StatusAPIEndpoints.components();
		case 'incidents':
			return StatusAPIEndpoints.Incidents.all();
		case 'incidents/unresolved':
			return StatusAPIEndpoints.Incidents.unresolved();
		case 'scheduled-maintenances':
			return StatusAPIEndpoints.ScheduledMaintenances.all();
		case 'scheduled-maintenances/active':
			return StatusAPIEndpoints.ScheduledMaintenances.active();
		case 'scheduled-maintenances/upcoming':
			return StatusAPIEndpoints.ScheduledMaintenances.upcoming();
	}
}

async function fetchStatusApiResource(
	resource: StatusApiResource,
	baseUrl: string | URL,
): Promise<unknown> {
	const url = new URL(statusApiEndpoint(resource), baseUrl);
	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(
			`Status API request failed with ${response.status} ${response.statusText}`,
		);
	}

	return response.json();
}

export {
	fetchStatusApiResource,
	statusApiEndpoint,
	statusApiResourceList,
	statusApiResources,
};
export type { StatusApiResource };
