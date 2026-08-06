"use client";
import {
  DataGrid,
  type DataGridProps,
  type GridValidRowModel,
} from "@mui/x-data-grid";
export function DataTable<R extends GridValidRowModel>(
  props: DataGridProps<R>,
) {
  return (
    <DataGrid
      disableRowSelectionOnClick
      pageSizeOptions={[10, 25, 50]}
      initialState={{
        pagination: { paginationModel: { pageSize: 10, page: 0 } },
      }}
      sx={{
        border: 0,
        minHeight: 420,
        "& .MuiDataGrid-columnHeaders": { bgcolor: "action.hover" },
      }}
      {...props}
    />
  );
}
