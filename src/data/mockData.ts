import { Property, Task } from '@/types/task';

export const mockProperties: Property[] = [
  {
    id: '1',
    name: 'Sunset Apartments',
    address: '123 Main St, Portland, OR 97204',
    type: 'Apartment Complex'
  },
  {
    id: '2',
    name: 'Oak Street Condos',
    address: '456 Oak St, Portland, OR 97205',
    type: 'Condominium'
  },
  {
    id: '3',
    name: 'River View Plaza',
    address: '789 River Rd, Portland, OR 97206',
    type: 'Commercial'
  },
  {
    id: '4',
    name: 'Pine Grove Homes',
    address: '321 Pine Ave, Portland, OR 97207',
    type: 'Single Family'
  }
];

export const mockTasks: Task[] = [
  {
    id: '1',
    title: 'Fix leaking faucet in Unit 2B',
    description: 'Tenant reported a dripping faucet in the kitchen. Needs immediate attention to prevent water damage.',
    propertyId: '1',
    status: 'pending',
    priority: 'high',
    dueDate: new Date(2025, 11, 30),
    assignedTo: 'John Smith',
    createdAt: new Date(2025, 11, 25)
  },
  {
    id: '2',
    title: 'HVAC maintenance check',
    description: 'Annual HVAC system inspection and filter replacement for all units.',
    propertyId: '1',
    status: 'in-progress',
    priority: 'medium',
    dueDate: new Date(2025, 11, 28),
    assignedTo: 'Mike Johnson',
    createdAt: new Date(2025, 11, 20)
  },
  {
    id: '3',
    title: 'Parking lot seal coating',
    description: 'Apply seal coat to parking lot surface and refresh parking line markings.',
    propertyId: '2',
    status: 'pending',
    priority: 'medium',
    dueDate: new Date(2025, 12, 5),
    assignedTo: 'Sarah Davis',
    createdAt: new Date(2025, 11, 22)
  },
  {
    id: '4',
    title: 'Replace exterior lighting',
    description: 'Install new LED fixtures in parking area for better visibility and energy efficiency.',
    propertyId: '3',
    status: 'completed',
    priority: 'low',
    dueDate: new Date(2025, 11, 20),
    assignedTo: 'Tom Wilson',
    createdAt: new Date(2025, 11, 10)
  },
  {
    id: '5',
    title: 'Landscape maintenance',
    description: 'Trim hedges, mow lawn, and remove dead plants from front entrance.',
    propertyId: '4',
    status: 'completed',
    priority: 'low',
    dueDate: new Date(2025, 11, 22),
    assignedTo: 'Lisa Brown',
    createdAt: new Date(2025, 11, 15)
  },
  {
    id: '6',
    title: 'Elevator inspection',
    description: 'State-required quarterly elevator safety inspection.',
    propertyId: '3',
    status: 'pending',
    priority: 'high',
    dueDate: new Date(2025, 11, 29),
    assignedTo: 'John Smith',
    createdAt: new Date(2025, 11, 24)
  }
];
