{{- define "wallofsuccess.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "wallofsuccess.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name (include "wallofsuccess.name" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "wallofsuccess.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" }}
app.kubernetes.io/name: {{ include "wallofsuccess.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{- define "wallofsuccess.secretName" -}}
{{- if .Values.app.existingSecret -}}
{{- .Values.app.existingSecret -}}
{{- else -}}
{{- printf "%s-app" (include "wallofsuccess.fullname" .) -}}
{{- end -}}
{{- end -}}

{{- define "wallofsuccess.postgresHost" -}}
{{- printf "%s-postgres" (include "wallofsuccess.fullname" .) -}}
{{- end -}}

{{/* Effective DATABASE_URL: managed postgres or external. */}}
{{- define "wallofsuccess.databaseUrl" -}}
{{- if .Values.postgres.enabled -}}
{{- printf "postgres://%s:%s@%s:%d/%s" .Values.postgres.username .Values.postgres.password (include "wallofsuccess.postgresHost" .) (int .Values.postgres.service.port) .Values.postgres.database -}}
{{- else -}}
{{- .Values.externalDatabaseUrl -}}
{{- end -}}
{{- end -}}
