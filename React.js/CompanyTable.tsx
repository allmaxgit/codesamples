import * as React from 'react';
import * as cn from 'classnames';

import { SimpleText, SimpleDate, TableRowType } from './TableElements';
import AwesomeFontIcon from '$components/AwesomeFontIcon';
import { company } from '$constants/statuses';

export const CompanyDormant: React.SFC<{ dormant: boolean }> = ({ dormant }) => {
  if (!dormant) return null;
  return <AwesomeFontIcon icon="fa-check" />;
}

export const CompanyStatus: React.SFC<{status: string}> = ({ status }) => (
  <span
    className={cn('label', {
      'label-primary': (status === company.ACTIVE),
      'label-warning': (status === company.PENDING),
      'label-danger': (status === company.ARCHIVED)
    })}
    data-order="1"
  >{status}</span>
);

const rows: TableRowType[] = [
  { field: 'id', title: 'ID', component: SimpleText('id') },
  { field: 'companyName', title: 'Company name', component: SimpleText('companyName') },
  { field: 'industry', title: 'Industry', component: SimpleText('industry') },
  { field: 'size', title: 'Size', component: SimpleText('size') },
  { field: 'dormant', title: 'Dormant', component: CompanyDormant },
  { field: 'createdAt', title: 'Created', component: SimpleDate('createdAt', 'DD.MM.YYYY') },
  { field: 'status', title: 'Status', component: CompanyStatus }
];

export default rows;
