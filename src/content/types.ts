export interface FieldMap {
  selector?: string;
  value?: string;
  apply?: () => void;
}

export type Adapter = (profile: any) => FieldMap[];
