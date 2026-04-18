import {
  type Control,
  Controller,
  type FieldValues,
  type Path,
} from "react-hook-form";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import {
  MultiSelect,
  MultiSelectContent,
  MultiSelectGroup,
  MultiSelectItem,
  MultiSelectTrigger,
  MultiSelectValue,
} from "@/components/ui/multi-select";

export interface AutocompleteOption {
  label: string;
  value: string;
}

interface CustomAutocompleteSelectProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label: string;
  placeholder?: string;
  options: AutocompleteOption[];
  loading?: boolean;
  disabled?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
}

export function CustomAutocompleteSelect<T extends FieldValues>({
  control,
  name,
  label,
  placeholder = "Select...",
  options,
  loading = false,
  disabled,
  searchPlaceholder = "Search...",
  emptyMessage = "No options found",
}: CustomAutocompleteSelectProps<T>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => {
        const selectedValue = typeof field.value === "string" ? field.value : "";

        return (
          <Field data-invalid={fieldState.invalid} className="w-full">
            <FieldLabel htmlFor={name}>{label}</FieldLabel>
            <MultiSelect
              single
              values={selectedValue ? [selectedValue] : []}
              onValuesChange={(values) => field.onChange(values[0] || "")}
            >
              <MultiSelectTrigger
                id={name}
                className="w-full"
                disabled={disabled || loading}
              >
                <MultiSelectValue placeholder={placeholder} clickToRemove={false} />
              </MultiSelectTrigger>
              <MultiSelectContent
                search={{
                  placeholder: searchPlaceholder,
                  emptyMessage,
                }}
              >
                <MultiSelectGroup>
                  {loading ? (
                    <div className="p-2 text-center text-sm text-muted-foreground">
                      Loading options...
                    </div>
                  ) : options.length === 0 ? (
                    <div className="p-2 text-center text-sm text-muted-foreground">
                      No options available
                    </div>
                  ) : (
                    options.map((option) => (
                      <MultiSelectItem key={option.value} value={option.value}>
                        {option.label}
                      </MultiSelectItem>
                    ))
                  )}
                </MultiSelectGroup>
              </MultiSelectContent>
            </MultiSelect>

            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        );
      }}
    />
  );
}
