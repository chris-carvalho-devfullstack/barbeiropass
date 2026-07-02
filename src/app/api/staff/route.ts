export const runtime = 'edge';

import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { staffFormSchema } from '@/utils/validations';
import { ZodError } from 'zod';

// Constantes de Segurança (Zero Trust)
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'];

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // 1. Autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // 2. Extração do FormData (Multipart) em vez de JSON
    const formData = await request.formData();
    const dataStr = formData.get('data') as string;
    const avatarFile = formData.get('avatar') as File | null;

    if (!dataStr) {
      return NextResponse.json({ error: 'Payload de dados ausente' }, { status: 400 });
    }

    // 3. Validação da Foto (Zero Trust API Level)
    if (avatarFile) {
      if (!ALLOWED_MIME_TYPES.includes(avatarFile.type)) {
        return NextResponse.json({ error: 'A foto deve ser PNG ou JPEG.' }, { status: 400 });
      }
      if (avatarFile.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: 'A foto não pode ultrapassar 5MB.' }, { status: 400 });
      }
    }

    // 4. Validação Zod dos dados em texto
    const parsedJson = JSON.parse(dataStr);
    const validatedData = staffFormSchema.parse(parsedJson);

    // ==========================================
    // NOVA BLINDAGEM: PROTEÇÃO CONTRA IDOR
    // ==========================================
    const { data: membership, error: membershipError } = await supabase
      .from('barbershop_members')
      .select('role')
      .eq('profile_id', user.id)
      .eq('barbershop_id', validatedData.barbershop_id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'Acesso negado. Não tem vínculo com esta barbearia.' }, { status: 403 });
    }

    if (membership.role !== 'owner' && membership.role !== 'manager') {
      return NextResponse.json({ error: 'Apenas proprietários ou gerentes podem adicionar membros à equipe.' }, { status: 403 });
    }
    // ==========================================

    // 5. Insere o profissional na tabela 'staff' (Ainda sem a foto)
    const { data: staffMember, error: staffError } = await supabase
      .from('staff')
      .insert({
        barbershop_id: validatedData.barbershop_id,
        profile_id: validatedData.profile_id || null,
        role: validatedData.role,
        full_name: validatedData.full_name,
        cpf: validatedData.cpf || null,
        cnpj: validatedData.cnpj || null,
        birth_date: validatedData.birth_date || null,
        address: validatedData.address || null,
        education_level: validatedData.education_level || null,
        barber_courses: validatedData.barber_courses || null,
        previous_experience: validatedData.previous_experience || null,
        payment_model: validatedData.payment_model,
        fixed_fee_amount: validatedData.fixed_fee_amount,
        is_active: true
      })
      .select('id, unique_code')
      .single();

    if (staffError) {
      if (staffError.code === '23505') {
        return NextResponse.json({ error: 'Este CPF ou CNPJ já está cadastrado nesta barbearia.' }, { status: 400 });
      }
      throw staffError;
    }

    // 6. Upload Seguro da Foto 
    if (avatarFile) {
      // Regra de "1 única foto": Criamos um nome de arquivo fixo ("avatar") + extensão original
      const fileExt = avatarFile.name.split('.').pop();
      const fileName = `avatar.${fileExt}`;
      const filePath = `${staffMember.id}/${fileName}`;

      // Passamos o avatarFile (File nativo) diretamente. Sem uso de Buffer.
      const { error: uploadError } = await supabase.storage
        .from('staff-avatars')
        .upload(filePath, avatarFile, {
          cacheControl: '3600',
          upsert: true 
        });

      if (!uploadError) {
        // Gera a URL pública da imagem recém-upada
        const { data: publicUrlData } = supabase.storage.from('staff-avatars').getPublicUrl(filePath);
        
        // ESTRATÉGIA DE CACHE BUSTING: Anexar timestamp
        const cacheBuster = `?v=${Date.now()}`;
        const finalAvatarUrl = `${publicUrlData.publicUrl}${cacheBuster}`;
        
        // Atualiza a tabela do staff com a URL da foto (agora com cache busting)
        await supabase.from('staff').update({ avatar_url: finalAvatarUrl }).eq('id', staffMember.id);
      } else {
        console.error("Erro no upload do avatar:", uploadError);
      }
    }

    // 7. Insere as regras de comissão (se houver)
    if (validatedData.payment_model === 'commission' && validatedData.services_commissions?.length) {
      const commissionsToInsert = validatedData.services_commissions.map((sc) => ({
        staff_id: staffMember.id,
        service_id: sc.service_id,
        commission_percentage: sc.commission_percentage
      }));

      await supabase.from('staff_service_commissions').insert(commissionsToInsert);
    }

    return NextResponse.json({ success: true, data: staffMember }, { status: 201 });

  } catch (error: unknown) {
    if (error instanceof ZodError) return NextResponse.json({ error: 'Erro de validação', issues: error.issues }, { status: 400 });
    if (error instanceof Error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}

// ==========================================
// EXCLUSÃO SEGURA NO SERVER-SIDE (DELETE)
// ==========================================
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();

    // 1. Verificação de Autenticação Básica
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // 2. Extração do ID do profissional a partir dos parâmetros da URL
    const { searchParams } = new URL(request.url);
    const staffId = searchParams.get('id');

    if (!staffId) {
      return NextResponse.json({ error: 'ID do profissional ausente' }, { status: 400 });
    }

    // 3. Busca o registro do staff para descobrir a qual barbearia ele pertence
    const { data: staffMember, error: staffFetchError } = await supabase
      .from('staff')
      .select('barbershop_id')
      .eq('id', staffId)
      .single();

    if (staffFetchError || !staffMember) {
      return NextResponse.json({ error: 'Profissional não encontrado' }, { status: 404 });
    }

    // 4. ZERO TRUST: Verifica o vínculo e o cargo do usuário autenticado nessa barbearia
    const { data: membership, error: membershipError } = await supabase
      .from('barbershop_members')
      .select('role')
      .eq('profile_id', user.id)
      .eq('barbershop_id', staffMember.barbershop_id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'Acesso negado. Não tem vínculo com esta barbearia.' }, { status: 403 });
    }

    if (membership.role !== 'owner' && membership.role !== 'manager') {
      return NextResponse.json({ error: 'Apenas proprietários ou gerentes podem excluir membros.' }, { status: 403 });
    }

    // 5. LIMPEZA DOS ARQUIVOS NO BUCKET (STORAGE)
    const { data: files } = await supabase.storage.from('staff-avatars').list(staffId);
    
    if (files && files.length > 0) {
      const filesToRemove = files.map((file) => `${staffId}/${file.name}`);
      const { error: storageError } = await supabase.storage
        .from('staff-avatars')
        .remove(filesToRemove);
        
      if (storageError) {
        console.error("Erro ao apagar imagem do storage:", storageError);
      }
    }

    // 6. Executa a exclusão de forma segura no ambiente do servidor
    const { error: deleteError } = await supabase
      .from('staff')
      .delete()
      .eq('id', staffId);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error: unknown) {
    if (error instanceof Error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}

// ==========================================
// ATUALIZAÇÃO SEGURA NO SERVER-SIDE (PUT)
// ==========================================
export async function PUT(request: Request) {
  try {
    const supabase = await createClient();

    // 1. Autenticação e extração do ID da URL
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const staffId = searchParams.get('id');
    if (!staffId) return NextResponse.json({ error: 'ID do profissional ausente' }, { status: 400 });

    // 2. Extração do FormData
    const formData = await request.formData();
    const dataStr = formData.get('data') as string;
    const avatarFile = formData.get('avatar') as File | null;

    if (!dataStr) return NextResponse.json({ error: 'Payload ausente' }, { status: 400 });

    // 3. Validação do arquivo (Zero Trust API Level)
    if (avatarFile) {
      if (!ALLOWED_MIME_TYPES.includes(avatarFile.type)) return NextResponse.json({ error: 'Formato inválido. Use PNG ou JPEG.' }, { status: 400 });
      if (avatarFile.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'Foto excedeu 5MB.' }, { status: 400 });
    }

    // Validação Zod
    const parsedJson = JSON.parse(dataStr);
    const validatedData = staffFormSchema.parse(parsedJson);

    // 4. Proteção IDOR (Garante que o usuário pode editar nesta barbearia)
    const { data: membership, error: membershipError } = await supabase
      .from('barbershop_members')
      .select('role')
      .eq('profile_id', user.id)
      .eq('barbershop_id', validatedData.barbershop_id)
      .single();

    if (membershipError || !membership || (membership.role !== 'owner' && membership.role !== 'manager')) {
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
    }

    // 5. Atualiza os dados na tabela 'staff'
    const { error: updateError } = await supabase
      .from('staff')
      .update({
        role: validatedData.role,
        full_name: validatedData.full_name,
        cpf: validatedData.cpf || null,
        cnpj: validatedData.cnpj || null,
        birth_date: validatedData.birth_date || null,
        address: validatedData.address || null,
        education_level: validatedData.education_level || null,
        barber_courses: validatedData.barber_courses || null,
        previous_experience: validatedData.previous_experience || null,
        payment_model: validatedData.payment_model,
        fixed_fee_amount: validatedData.fixed_fee_amount,
      })
      .eq('id', staffId);

    if (updateError) {
      if (updateError.code === '23505') return NextResponse.json({ error: 'CPF/CNPJ já cadastrado.' }, { status: 400 });
      throw updateError;
    }

    // 6. Atualiza a foto (Upsert) se uma nova foi enviada
    if (avatarFile) {
      const fileExt = avatarFile.name.split('.').pop();
      const fileName = `avatar.${fileExt}`;
      const filePath = `${staffId}/${fileName}`;

      // Upload do File nativo
      const { error: uploadError } = await supabase.storage
        .from('staff-avatars')
        .upload(filePath, avatarFile, { cacheControl: '3600', upsert: true });

      if (!uploadError) {
        const { data: publicUrlData } = supabase.storage.from('staff-avatars').getPublicUrl(filePath);
        const cacheBuster = `?v=${Date.now()}`;
        await supabase.from('staff').update({ avatar_url: `${publicUrlData.publicUrl}${cacheBuster}` }).eq('id', staffId);
      } else {
        console.error("Erro no upload do avatar na atualização:", uploadError);
      }
    }

    // 7. Atualiza as comissões (Apaga as antigas e insere as novas)
    await supabase.from('staff_service_commissions').delete().eq('staff_id', staffId);
    
    if (validatedData.payment_model === 'commission' && validatedData.services_commissions?.length) {
      const commissionsToInsert = validatedData.services_commissions.map((sc) => ({
        staff_id: staffId,
        service_id: sc.service_id,
        commission_percentage: sc.commission_percentage
      }));
      await supabase.from('staff_service_commissions').insert(commissionsToInsert);
    }

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error: unknown) {
    if (error instanceof ZodError) return NextResponse.json({ error: 'Erro de validação', issues: error.issues }, { status: 400 });
    if (error instanceof Error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}

// Adicione no final do arquivo: src/app/api/staff/route.ts

// ==========================================
// BUSCA SEGURA DE EQUIPE (GET) - ZERO TRUST
// ==========================================
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    
    // 1. Verifica quem está logado
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // 2. Descobre de qual barbearia este usuário faz parte
    const { data: member, error: memberError } = await supabase
      .from('barbershop_members')
      .select('barbershop_id')
      .eq('profile_id', user.id)
      .single();

    if (memberError || !member) {
      return NextResponse.json({ error: 'Vínculo com barbearia não encontrado.' }, { status: 403 });
    }

    // 3. Busca APENAS os funcionários ativos desta barbearia específica
    const { data: staff, error: staffError } = await supabase
      .from('staff')
      .select('id, full_name')
      .eq('barbershop_id', member.barbershop_id)
      .eq('is_active', true)
      .order('full_name', { ascending: true });

    if (staffError) throw staffError;

    return NextResponse.json({ staff });
  } catch (error: unknown) {
    console.error("Erro ao buscar equipe:", error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}