import * as React from 'react';
import * as cn from 'classnames';
import { Table } from 'react-bootstrap';

import { TableRowType } from '$components/Tables/TableElements';

interface Props {
  rows: any[];
  columns: TableRowType[];
  sortBy?: TableRowType['field'];
  ascending?: boolean;
  current?: string;
  onClick?: (row: any) => void;
  onSortingChange?: (sortBy: TableRowType['field']) => void;
  onOrderChange?: (ascending: boolean) => void;
  highlight?: string;
}

const NewTable: React.SFC<Props> = ({
  rows, columns, sortBy, ascending,
  current, highlight, onClick,
  onSortingChange, onOrderChange
}) => {
  return (
    <div className="custom-table">
      <Table hover responsive>
        <thead>
          <tr>
            {
              columns.map(({ field, title }) => (
                <th
                  key={field}
                  className={cn({
                    '--current': (field === sortBy),
                    '--reverse': ascending
                  })}
                  onClick={() => (field === sortBy) ? onOrderChange(!ascending) : onSortingChange(field)}
                >{title}</th>
              ))
            }
          </tr>
        </thead>
        <tbody>
          {
            rows.map(row => (
              <tr
                key={row.id}
                className={cn({
                  '--current': (row.id === current),
                  '--highlighted': (`${row.id}` === highlight)
                })}
                onClick={() => onClick(row)}
              >
                {columns.map(({ field, component }) => <td key={field}>{component(row)}</td>)}
              </tr>
            ))
          }
        </tbody>
      </Table>
    </div>
  );
}

NewTable.defaultProps = {
  sortBy: null,
  current: null,
  highlight: null,
  ascending: false,
  onClick: () => null,
  onSortingChange: () => null,
  onOrderChange: () => null
}

export default NewTable;
